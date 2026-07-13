"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addCatalogItem,
  addKnowledge,
  addVehicleModel,
  addWorkshopMod,
  deleteCatalogItem,
  deleteKnowledge,
  deleteQuote,
  deleteVehicleModel,
  deleteWorkshopMod,
  getActiveKnowledge,
  getQuote,
  getSettings,
  getVehicleModel,
  insertQuote,
  listCatalog,
  logActivity,
  mergeCatalogItems,
  setKnowledgeActive,
  setQuoteShareEnabled,
  setQuoteVehicle,
  updateCatalogItem,
  updateQuote,
  updateSettings,
  updateVehicleModel,
  updateWorkshopMod,
  uploadBrandAsset as uploadBrandAssetFile,
  uploadBuildDocument,
} from "@/lib/data";
import { providerFor } from "@/lib/ai";
import type { ExtractDoc, QuoteContext } from "@/lib/ai/provider";
import { parseUploadedFile } from "@/lib/intake/parse";
import { normalizeBuildSpec, specFromForm } from "@/lib/spec";
import type {
  AiProviderName,
  BuildSpec,
  CatalogItem,
  CutZone,
  DocType,
  QuoteStatus,
  TruckType,
  WorkshopMod,
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

  await logActivity(id!, "created", "Quote created from customer intake");
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
  await logActivity(id, "generated", `Quote generated (${result.provider})`);

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
  await logActivity(id, "refined", `Refined: ${instruction.slice(0, 120)}`);

  revalidatePath(`/quotes/${id}`);
  redirect(`/quotes/${id}`);
}

// ----- Builder (interactive layout) -----------------------------------------

export async function saveBuilderSpec(
  quoteId: string,
  specJson: string,
  reprice: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const quote = await getQuote(quoteId);
  if (!quote) return { ok: false, error: "Quote not found." };

  let spec: BuildSpec;
  try {
    spec = normalizeBuildSpec(JSON.parse(specJson), quote.truck_type);
  } catch {
    return { ok: false, error: "Could not read the layout." };
  }

  if (!reprice) {
    await updateQuote(quoteId, { build_spec: spec });
    await logActivity(quoteId, "spec_updated", "Layout saved in the builder");
    revalidatePath(`/quotes/${quoteId}`);
    return { ok: true };
  }

  const ctx = await buildContext({
    customerName: quote.customer_name,
    customerCompany: quote.customer_company,
    customerContact: quote.customer_contact,
    truckType: spec.truckType,
    requirements: quote.requirements,
    spec,
  });
  try {
    const result = await providerFor(ctx.settings).generate(ctx);
    await updateQuote(quoteId, {
      build_spec: spec,
      quote_data: result.quote,
      ai_provider: result.provider,
      ai_model: result.model,
    });
    await logActivity(quoteId, "generated", "Layout saved & quote re-priced from the builder");
  } catch (err) {
    await updateQuote(quoteId, { build_spec: spec });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Re-pricing failed (layout saved).",
    };
  }
  revalidatePath(`/quotes/${quoteId}`);
  return { ok: true };
}

export async function uploadBrandAsset(
  formData: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const quoteId = String(formData.get("quoteId") ?? "");
  const file = formData.get("file");
  if (!quoteId || !(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "Logo must be under 5MB." };
  }
  try {
    const url = await uploadBrandAssetFile({
      quote_id: quoteId,
      filename: file.name || "logo.png",
      mime_type: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return { ok: true, url };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Upload failed.",
    };
  }
}

export async function aiEditSpec(
  quoteId: string,
  specJson: string,
  instruction: string,
): Promise<{ ok: boolean; spec?: BuildSpec; note?: string; error?: string }> {
  const quote = await getQuote(quoteId);
  if (!quote) return { ok: false, error: "Quote not found." };
  if (!instruction.trim()) return { ok: false, error: "Describe a change first." };

  let current: BuildSpec;
  try {
    current = normalizeBuildSpec(JSON.parse(specJson), quote.truck_type);
  } catch {
    return { ok: false, error: "Could not read the current layout." };
  }

  const [settings, knowledge] = await Promise.all([
    getSettings(),
    getActiveKnowledge(),
  ]);
  try {
    const result = await providerFor(settings).editSpec(current, instruction, {
      truckType: current.truckType,
      knowledge,
      settings,
    });
    return { ok: true, spec: result.spec, note: result.note };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "AI edit failed.",
    };
  }
}

export async function setQuoteShareAction(formData: FormData) {
  const id = String(formData.get("quoteId") ?? "");
  const enabled = String(formData.get("enabled") ?? "false") === "true";
  await setQuoteShareEnabled(id, enabled);
  await logActivity(id, "share", enabled ? "Customer link enabled" : "Customer link disabled");
  revalidatePath(`/quotes/${id}`);
}

export async function setQuoteStatusAction(formData: FormData) {
  const id = String(formData.get("quoteId") ?? "");
  const status = String(formData.get("status") ?? "draft") as QuoteStatus;
  await updateQuote(id, { status });
  await logActivity(id, "status", `Status set to ${status}`);
  revalidatePath(`/quotes/${id}`);
  revalidatePath("/");
}

// Callable (non-form) status change used by the pipeline board's drag & drop.
export async function setQuoteStatus(
  id: string,
  status: QuoteStatus,
): Promise<{ ok: boolean }> {
  if (!id) return { ok: false };
  await updateQuote(id, { status });
  await logActivity(id, "status", `Status set to ${status}`);
  revalidatePath("/");
  revalidatePath(`/quotes/${id}`);
  return { ok: true };
}

// Sales notes + follow-up reminder from the quote page's sales panel.
export async function saveSalesInfoAction(formData: FormData) {
  const id = String(formData.get("quoteId") ?? "");
  const sales_notes = String(formData.get("sales_notes") ?? "");
  const followUp = String(formData.get("follow_up_at") ?? "").trim();
  await updateQuote(id, {
    sales_notes,
    follow_up_at: followUp ? new Date(followUp).toISOString() : null,
  });
  await logActivity(id, "sales", followUp ? `Sales info saved · follow-up ${followUp}` : "Sales info saved");
  revalidatePath(`/quotes/${id}`);
  revalidatePath("/");
  redirect(`/quotes/${id}`);
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

// Upload files (PDF, docx, eml/msg, images, text) as training material. Text
// formats are parsed locally; PDFs/images are transcribed by the connected AI.
export async function addKnowledgeFilesAction(formData: FormData) {
  const files = formData
    .getAll("documents")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_FILES);
  if (!files.length) redirect("/knowledge");

  const settings = await getSettings();
  const provider = providerFor(settings);
  let added = 0;
  const warnings: string[] = [];

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      warnings.push(`${file.name}: larger than 10MB, skipped`);
      continue;
    }
    const doc = await parseUploadedFile(file);
    if (doc.warning) {
      warnings.push(doc.warning);
      if (!doc.text && !doc.media) continue;
    }
    let content = doc.text;
    if (!content && doc.media) {
      try {
        content = await provider.transcribe(
          { filename: doc.filename, text: doc.text, media: doc.media },
          settings,
        );
      } catch (err) {
        warnings.push(
          `${file.name}: ${err instanceof Error ? err.message : "transcription failed"}`,
        );
        continue;
      }
      if (!content) {
        warnings.push(
          `${file.name}: PDFs/images need the AI provider connected to be read — skipped`,
        );
        continue;
      }
    }
    if (!content.trim()) {
      warnings.push(`${file.name}: no readable text found`);
      continue;
    }

    const name = file.name.replace(/\.[^.]+$/, "");
    const doc_type: DocType = /\.(eml|msg)$/i.test(file.name)
      ? "email"
      : /pric/i.test(file.name)
        ? "pricing"
        : /quote|estimate/i.test(file.name)
          ? "quote"
          : "documentation";
    await addKnowledge({ title: name || file.name, doc_type, content: content.trim() });
    added++;
  }

  revalidatePath("/knowledge");
  const params = new URLSearchParams({ added: String(added) });
  if (warnings.length) params.set("warn", warnings.join(" · "));
  redirect(`/knowledge?${params.toString()}`);
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

// ----- Equipment catalog -----------------------------------------------------

export async function extractCatalogAction() {
  const [settings, knowledge, existing] = await Promise.all([
    getSettings(),
    getActiveKnowledge(),
    listCatalog(),
  ]);
  const provider = providerFor(settings);
  let added = 0;
  let note = "";
  try {
    const result = await provider.extractCatalog({
      knowledge,
      existingNames: existing.map((i) => i.name),
      settings,
    });
    added = await mergeCatalogItems(result.items);
    note = result.note ?? "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Extraction failed";
    revalidatePath("/knowledge");
    redirect(`/knowledge?error=${encodeURIComponent(msg)}#catalog`);
  }
  revalidatePath("/knowledge");
  redirect(
    `/knowledge?catalog=${added}&note=${encodeURIComponent(note)}#catalog`,
  );
}

export async function addCatalogItemAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/knowledge#catalog");
  await addCatalogItem({
    name,
    category: String(formData.get("category") ?? "equipment") as CatalogItem["category"],
    length_ft: Number(formData.get("length_ft") ?? 3) || 3,
    depth_ft: Number(formData.get("depth_ft") ?? 2.2) || 2.2,
    height_ft: Number(formData.get("height_ft") ?? 3) || 3,
    unit_price: Number(formData.get("unit_price") ?? 0) || 0,
    power_watts: Number(formData.get("power_watts") ?? 0) || 0,
    weight_lbs: Number(formData.get("weight_lbs") ?? 0) || 0,
    tags: String(formData.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    notes: String(formData.get("notes") ?? "").trim(),
  });
  revalidatePath("/knowledge");
  redirect("/knowledge#catalog");
}

export async function updateCatalogItemAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/knowledge#catalog");
  await updateCatalogItem(id, {
    name: String(formData.get("name") ?? "").trim() || "Untitled",
    category: String(formData.get("category") ?? "equipment") as CatalogItem["category"],
    length_ft: Number(formData.get("length_ft") ?? 3) || 3,
    depth_ft: Number(formData.get("depth_ft") ?? 2.2) || 2.2,
    height_ft: Number(formData.get("height_ft") ?? 3) || 3,
    unit_price: Number(formData.get("unit_price") ?? 0) || 0,
    power_watts: Number(formData.get("power_watts") ?? 0) || 0,
    weight_lbs: Number(formData.get("weight_lbs") ?? 0) || 0,
    tags: String(formData.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  });
  revalidatePath("/knowledge");
  redirect("/knowledge#catalog");
}

export async function deleteCatalogItemAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await deleteCatalogItem(id);
  revalidatePath("/knowledge");
  redirect("/knowledge#catalog");
}

// ----- Vehicle models --------------------------------------------------------

function parseNums(s: string): number[] {
  return s
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n));
}

function vehicleFromForm(formData: FormData) {
  return {
    label: String(formData.get("label") ?? "").trim() || "Untitled vehicle",
    make: String(formData.get("make") ?? "").trim(),
    model: String(formData.get("model") ?? "").trim(),
    variant: String(formData.get("variant") ?? "").trim(),
    is_trailer: formData.get("is_trailer") != null,
    length_ft: Number(formData.get("length_ft") ?? 20) || 20,
    width_ft: Number(formData.get("width_ft") ?? 8) || 8,
    height_ft: Number(formData.get("height_ft") ?? 9.5) || 9.5,
    cab_length_ft: Number(formData.get("cab_length_ft") ?? 4) || 0,
    wheelbase_ft: Number(formData.get("wheelbase_ft") ?? 12) || 0,
    axle_positions: parseNums(String(formData.get("axle_positions") ?? "")),
    gvwr_lbs: Number(formData.get("gvwr_lbs") ?? 0) || 0,
    curb_weight_lbs: Number(formData.get("curb_weight_lbs") ?? 0) || 0,
    cut_zones: [] as CutZone[],
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

export async function addVehicleAction(formData: FormData) {
  await addVehicleModel(vehicleFromForm(formData));
  revalidatePath("/vehicles");
  redirect("/vehicles");
}

export async function updateVehicleAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/vehicles");
  await updateVehicleModel(id, vehicleFromForm(formData));
  revalidatePath("/vehicles");
  redirect("/vehicles");
}

export async function deleteVehicleAction(formData: FormData) {
  await deleteVehicleModel(String(formData.get("id") ?? ""));
  revalidatePath("/vehicles");
  redirect("/vehicles");
}

// ----- Workshop modifications ------------------------------------------------

function modFromForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim() || "Untitled mod",
    category: String(formData.get("category") ?? "exterior") as WorkshopMod["category"],
    unit_price: Number(formData.get("unit_price") ?? 0) || 0,
    labor_hours: Number(formData.get("labor_hours") ?? 0) || 0,
    allowed_zones: String(formData.get("allowed_zones") ?? "")
      .split(",")
      .map((z) => z.trim())
      .filter(Boolean),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

export async function addModAction(formData: FormData) {
  await addWorkshopMod(modFromForm(formData));
  revalidatePath("/vehicles");
  redirect("/vehicles#mods");
}

export async function updateModAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/vehicles#mods");
  await updateWorkshopMod(id, modFromForm(formData));
  revalidatePath("/vehicles");
  redirect("/vehicles#mods");
}

export async function deleteModAction(formData: FormData) {
  await deleteWorkshopMod(String(formData.get("id") ?? ""));
  revalidatePath("/vehicles");
  redirect("/vehicles#mods");
}

// Choose the base vehicle for a quote; copies its body dims into the spec so
// the size is consistent everywhere (incl. the customer share page).
export async function setQuoteVehicleAction(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "");
  const vehicleId = String(formData.get("vehicleModelId") ?? "");
  const quote = await getQuote(quoteId);
  if (!quote) redirect("/");
  if (!vehicleId) {
    await setQuoteVehicle(quoteId, null);
  } else {
    const vehicle = await getVehicleModel(vehicleId);
    await setQuoteVehicle(quoteId, vehicleId);
    if (vehicle) {
      const spec = normalizeBuildSpec(
        {
          ...quote.build_spec,
          baseVehicle: vehicle.label,
          dimensions: {
            lengthFt: vehicle.length_ft,
            widthFt: vehicle.width_ft,
            heightFt: vehicle.height_ft,
          },
        },
        quote.truck_type,
      );
      await updateQuote(quoteId, { build_spec: spec });
    }
  }
  revalidatePath(`/quotes/${quoteId}`);
  redirect(`/quotes/${quoteId}/spec`);
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
