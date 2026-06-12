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
} from "@/lib/data";
import { providerFor } from "@/lib/ai";
import type { QuoteContext } from "@/lib/ai/provider";
import type {
  AiProviderName,
  DocType,
  QuoteStatus,
  TruckType,
} from "@/lib/types";

async function buildContext(input: {
  customerName: string;
  customerCompany: string;
  customerContact: string;
  truckType: TruckType;
  requirements: string;
}): Promise<QuoteContext> {
  const [settings, knowledge] = await Promise.all([
    getSettings(),
    getActiveKnowledge(),
  ]);
  return { ...input, knowledge, settings };
}

// ----- Quote generation -----------------------------------------------------

export async function createQuoteAction(formData: FormData) {
  const input = {
    customerName: String(formData.get("customerName") ?? "").trim(),
    customerCompany: String(formData.get("customerCompany") ?? "").trim(),
    customerContact: String(formData.get("customerContact") ?? "").trim(),
    truckType: (String(formData.get("truckType") ?? "food_truck") as TruckType),
    requirements: String(formData.get("requirements") ?? "").trim(),
  };

  const ctx = await buildContext(input);
  const provider = providerFor(ctx.settings);

  let result;
  try {
    result = await provider.generate(ctx);
  } catch (err) {
    // Surface provider errors back to the form page via query param.
    const msg = err instanceof Error ? err.message : "Generation failed";
    redirect(`/quotes/new?error=${encodeURIComponent(msg)}`);
  }

  const id = await insertQuote({
    customer_name: input.customerName,
    customer_company: input.customerCompany,
    customer_contact: input.customerContact,
    truck_type: input.truckType,
    requirements: input.requirements,
    quote_data: result.quote,
    ai_provider: result.provider,
    ai_model: result.model,
  });

  revalidatePath("/");
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
