import "server-only";
import { getSupabase } from "./supabase";
import { normalizeQuoteData } from "./quote";
import { normalizeBuildSpec } from "./spec";
import type {
  AiSettings,
  BuildDocument,
  BuildSpec,
  Quote,
  QuoteData,
  QuoteStatus,
  TrainingDocument,
} from "./types";

// ----- AI settings (single row) --------------------------------------------

const DEFAULT_SETTINGS: AiSettings = {
  id: "default",
  updated_at: new Date().toISOString(),
  provider: "sample",
  model: "",
  base_url: "",
  system_prompt: "",
  temperature: 0.3,
  extra: {},
};

export async function getSettings(): Promise<AiSettings> {
  const sb = getSupabase();
  const { data } = await sb
    .from("ai_settings")
    .select("*")
    .eq("singleton", true)
    .maybeSingle();
  return (data as AiSettings) ?? DEFAULT_SETTINGS;
}

export async function updateSettings(
  patch: Partial<Pick<AiSettings, "provider" | "model" | "base_url" | "system_prompt" | "temperature">>,
): Promise<void> {
  const sb = getSupabase();
  await sb.from("ai_settings").update(patch).eq("singleton", true);
}

// ----- Knowledge base / training documents ---------------------------------

export async function listKnowledge(): Promise<TrainingDocument[]> {
  const sb = getSupabase();
  const { data } = await sb
    .from("training_documents")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as TrainingDocument[]) ?? [];
}

export async function getActiveKnowledge(): Promise<TrainingDocument[]> {
  const sb = getSupabase();
  const { data } = await sb
    .from("training_documents")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });
  return (data as TrainingDocument[]) ?? [];
}

export async function addKnowledge(
  doc: Pick<TrainingDocument, "title" | "doc_type" | "content"> & {
    tags?: string[];
  },
): Promise<void> {
  const sb = getSupabase();
  await sb.from("training_documents").insert({
    title: doc.title,
    doc_type: doc.doc_type,
    content: doc.content,
    tags: doc.tags ?? [],
  });
}

export async function setKnowledgeActive(
  id: string,
  active: boolean,
): Promise<void> {
  const sb = getSupabase();
  await sb.from("training_documents").update({ active }).eq("id", id);
}

export async function deleteKnowledge(id: string): Promise<void> {
  const sb = getSupabase();
  await sb.from("training_documents").delete().eq("id", id);
}

// ----- Quotes ---------------------------------------------------------------

export async function listQuotes(): Promise<Quote[]> {
  const sb = getSupabase();
  const { data } = await sb
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as Quote[]) ?? [];
}

export async function getQuote(id: string): Promise<Quote | null> {
  const sb = getSupabase();
  const { data } = await sb.from("quotes").select("*").eq("id", id).maybeSingle();
  return (data as Quote) ?? null;
}

export async function insertQuote(q: {
  customer_name: string;
  customer_company: string;
  customer_contact: string;
  truck_type: string;
  requirements: string;
  quote_data: QuoteData;
  build_spec?: BuildSpec;
  ai_provider: string;
  ai_model: string;
}): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("quotes")
    .insert({ ...q, status: "draft" as QuoteStatus })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function updateQuote(
  id: string,
  patch: {
    quote_data?: QuoteData;
    build_spec?: BuildSpec;
    status?: QuoteStatus;
    ai_provider?: string;
    ai_model?: string;
    revisions?: Quote["revisions"];
  },
): Promise<void> {
  const sb = getSupabase();
  const out: Record<string, unknown> = { ...patch };
  if (patch.quote_data) out.quote_data = normalizeQuoteData(patch.quote_data);
  if (patch.build_spec) out.build_spec = normalizeBuildSpec(patch.build_spec);
  await sb.from("quotes").update(out).eq("id", id);
}

// ----- Share links -----------------------------------------------------------

export interface SharedQuote {
  id: string;
  created_at: string;
  updated_at: string;
  status: QuoteStatus;
  customer_name: string;
  customer_company: string;
  truck_type: Quote["truck_type"];
  quote_data: QuoteData;
  build_spec: BuildSpec;
}

/** Public, token-gated read used by the customer-facing share page. */
export async function getSharedQuote(token: string): Promise<SharedQuote | null> {
  const sb = getSupabase();
  const { data } = await sb.rpc("get_shared_quote", { token }).maybeSingle();
  return (data as SharedQuote) ?? null;
}

export async function setQuoteShareEnabled(
  id: string,
  enabled: boolean,
): Promise<string | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("quotes")
    .update({ share_enabled: enabled })
    .eq("id", id)
    .select("share_token")
    .maybeSingle();
  return (data as { share_token: string } | null)?.share_token ?? null;
}

export async function getQuoteShare(
  id: string,
): Promise<{ share_token: string; share_enabled: boolean } | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("quotes")
    .select("share_token, share_enabled")
    .eq("id", id)
    .maybeSingle();
  return (data as { share_token: string; share_enabled: boolean }) ?? null;
}

// ----- Build documents (customer uploads) -----------------------------------

const DOCS_BUCKET = "build-documents";

export async function uploadBuildDocument(doc: {
  quote_id: string;
  filename: string;
  mime_type: string;
  bytes: Buffer;
  extracted_text: string;
}): Promise<void> {
  const sb = getSupabase();
  // Keep paths unique + free of exotic characters.
  const safeName = doc.filename.replace(/[^\w.\-]+/g, "_").slice(-100);
  const storage_path = `${doc.quote_id}/${Date.now()}-${safeName}`;

  const { error: upErr } = await sb.storage
    .from(DOCS_BUCKET)
    .upload(storage_path, doc.bytes, {
      contentType: doc.mime_type || "application/octet-stream",
    });
  // Keep the metadata row even if the blob upload fails — the extracted text
  // is the part the AI actually used.
  await sb.from("build_documents").insert({
    quote_id: doc.quote_id,
    filename: doc.filename,
    mime_type: doc.mime_type,
    storage_path: upErr ? "" : storage_path,
    size_bytes: doc.bytes.byteLength,
    extracted_text: doc.extracted_text,
  });
}

export async function listBuildDocuments(
  quoteId: string,
): Promise<BuildDocument[]> {
  const sb = getSupabase();
  const { data } = await sb
    .from("build_documents")
    .select("*")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: true });
  return (data as BuildDocument[]) ?? [];
}

export async function deleteQuote(id: string): Promise<void> {
  const sb = getSupabase();
  await sb.from("quotes").delete().eq("id", id);
}
