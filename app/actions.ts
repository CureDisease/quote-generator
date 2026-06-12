"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addKnowledge,
  deleteKnowledge,
  deleteQuote,
  getActiveKnowledge,
  getQuote,
  getSettings,
  insertQuote,
  setKnowledgeActive,
  updateQuote,
  updateSettings,
  uploadBuildDocument,
} from "@/lib/data";
import { providerFor } from "@/lib/ai";
import type { ExtractDoc, QuoteContext } from "@/lib/ai/provider";
import { parseUploadedFile } from "@/lib/intake/parse";
import { specFromForm } from "@/lib/spec";
import type {
  AiProviderName,
  BuildSpec,
  DocType,
  QuoteStatus,
  TruckType,
} from "@/lib/types";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB per file
const MAX_FILES = 10;

async function buildContext(input: {
  customerName: string;
  customerCompany: string;
  customerContact: string;
  truckType: TruckType;
  requirements: string;
  spec?: BuildSpec;
}): Promise<QuoteContext> {
  const [settings, knowledge] = await Promise.all([
    getSettings(),
    getActiveKnowledge(),
  ]);
  return { ...input, knowledge, settings };
}

// ----- Intake: documents -> build spec --------------------------------------

export async function intakeQuoteAction(formData: FormData) {
  const input = {
    customerName: String(formData.get("customerName") ?? "").trim(),
    customerCompany: String(formData.get("customerCompany") ?? "").trim(),
    customerContact: String(formData.get("customerContact") ?? "").trim(),
    truckType: (String(formData.get("truckType") ?? "food_truck") as TruckType),
    requirements: String(formData.get("requirements") ?? "").trim(),
  };

  const files = formData
    .getAll("documents")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_FILES);

  let id: string;
  try {
    // 1. Parse every uploaded file (text extraction / native media blocks).
    const warnings: string[] = [];
    const parsed = [];
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        warnings.push(
          `${file.name} is larger than 10MB and was skipped — attach a smaller version.`,
        );
        continue;
      }
      const doc = await parseUploadedFile(file);
      if (doc.warning) warnings.push(doc.warning);
      parsed.push(doc);
    }

    // 2. Extract a structured build spec from the documents.
    const [settings, knowledge] = await Promise.all([
      getSettings(),
      getActiveKnowledge(),
    ]);
    const provider = providerFor(settings);
    const extractDocs: ExtractDoc[] = parsed.map((d) => ({
      filename: d.filename,
      text: d.text,
      media: d.media,
    }));
    const result = await provider.extractSpec({
      ...input,
      documents: extractDocs,
      knowledge,
      settings,
    });

    // Surface parse warnings to the estimator alongside the AI's own questions.
    const spec = {
      ...result.spec,
      openQuestions: [...result.spec.openQuestions, ...warnings],
    };

    // 3. Create the quote shell (quote generated after the spec is reviewed).
    id = await insertQuote({
      customer_name: input.customerName,
      customer_company: input.customerCompany,
      customer_contact: input.customerContact,
      truck_type: spec.truckType,
      requirements: input.requirements,
      quote_data: {
        title: "",
        currency: "USD",
        lineItems: [],
        subtotal: 0,
        taxRate: 0,
        tax: 0,
        total: 0,
        leadTime: "",
        notes: "",
        terms: "",
      },
      build_spec: spec,
      ai_provider: result.provider,
      ai_model: result.model,
    });

    // 4. Persist the original files + extracted text against the quote.
    for (const d of parsed) {
      const file = files.find((f) => f.name === d.filename);
      if (!file) continue;
      await uploadBuildDocument({
        quote_id: id,
        filename: d.filename,
        mime_type: d.mimeType,
        bytes: Buffer.from(await file.arrayBuffer()),
        extracted_text: d.text,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Document processing failed";
    redirect(`/quotes/new?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/");
  redirect(`/quotes/${id!}/spec`);
}

// ----- Quote generation (from reviewed spec) --------------------------------

export async function generateQuoteAction(formData: FormData) {
  const id = String(formData.get("quoteId") ?? "");
  const quote = await getQuote(id);
  if (!quote) redirect("/");

  const spec = specFromForm(formData, quote!.truck_type);

  const ctx = await buildContext({
    customerName: quote!.customer_name,
    customerCompany: quote!.customer_company,
    customerContact: quote!.customer_contact,
    truckType: spec.truckType,
    requirements: quote!.requirements,
    spec,
  });
  const provider = providerFor(ctx.settings);

  let result;
  try {
    result = await provider.generate(ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    // Save the edited spec even when generation fails.
    await updateQuote(id, { build_spec: spec });
    redirect(`/quotes/${id}/spec?error=${encodeURIComponent(msg)}`);
  }

  await updateQuote(id, {
    quote_data: result.quote,
    build_spec: spec,
    ai_provider: result.provider,
    ai_model: result.model,
  });

  revalidatePath("/");
  revalidatePath(`/quotes/${id}`);
  redirect(`/quotes/${id}`);
}

export async function refineQuoteAction(formData: FormData) {
  const id = String(formData.get("quoteId") ?? "");
  const instruction = String(formData.get("instruction") ?? "").trim();
  const quote = await getQuote(id);
  if (!quote || !instruction) {
    redirect(`/quotes/${id}`);
  }

  const ctx = await buildContext({
    customerName: quote!.customer_name,
    customerCompany: quote!.customer_company,
    customerContact: quote!.customer_contact,
    truckType: quote!.truck_type,
    requirements: quote!.requirements,
    spec: quote!.build_spec,
  });
  const provider = providerFor(ctx.settings);

  let result;
  try {
    result = await provider.refine(quote!.quote_data, instruction, ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Refinement failed";
    redirect(`/quotes/${id}?error=${encodeURIComponent(msg)}`);
  }

  const revisions = [
    ...(quote!.revisions ?? []),
    {
      at: new Date().toISOString(),
      request: instruction,
      summary: result.note ?? "Quote updated",
    },
  ];

  await updateQuote(id, {
    quote_data: result.quote,
    status: "revised",
    ai_provider: result.provider,
    ai_model: result.model,
    revisions,
  });

  revalidatePath(`/quotes/${id}`);
  redirect(`/quotes/${id}`);
}

export async function setQuoteStatusAction(formData: FormData) {
  const id = String(formData.get("quoteId") ?? "");
  const status = String(formData.get("status") ?? "draft") as QuoteStatus;
  await updateQuote(id, { status });
  revalidatePath(`/quotes/${id}`);
  revalidatePath("/");
}

export async function deleteQuoteAction(formData: FormData) {
  const id = String(formData.get("quoteId") ?? "");
  await deleteQuote(id);
  revalidatePath("/");
  redirect("/");
}

// ----- Knowledge base -------------------------------------------------------

export async function addKnowledgeAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const doc_type = String(formData.get("doc_type") ?? "documentation") as DocType;
  const content = String(formData.get("content") ?? "").trim();
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (!content) redirect("/knowledge");
  await addKnowledge({ title: title || "Untitled", doc_type, content, tags });
  revalidatePath("/knowledge");
  redirect("/knowledge");
}

export async function toggleKnowledgeAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "false") === "true";
  await setKnowledgeActive(id, active);
  revalidatePath("/knowledge");
}

export async function deleteKnowledgeAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await deleteKnowledge(id);
  revalidatePath("/knowledge");
}

// ----- AI behavior / provider settings --------------------------------------

export async function updateSettingsAction(formData: FormData) {
  const provider = String(formData.get("provider") ?? "sample") as AiProviderName;
  const model = String(formData.get("model") ?? "").trim();
  const base_url = String(formData.get("base_url") ?? "").trim();
  const system_prompt = String(formData.get("system_prompt") ?? "");
  const temperature = Number(formData.get("temperature") ?? 0.3) || 0.3;
  await updateSettings({ provider, model, base_url, system_prompt, temperature });
  revalidatePath("/knowledge");
  redirect("/knowledge?saved=1");
}
