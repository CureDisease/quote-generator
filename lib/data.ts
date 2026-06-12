import "server-only";
import { getSupabase } from "./supabase";
import { normalizeQuoteData } from "./quote";
import type {
  AiSettings,
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
    status?: QuoteStatus;
    ai_provider?: string;
    ai_model?: string;
    revisions?: Quote["revisions"];
  },
): Promise<void> {
  const sb = getSupabase();
  const out: Record<string, unknown> = { ...patch };
  if (patch.quote_data) out.quote_data = normalizeQuoteData(patch.quote_data);
  await sb.from("quotes").update(out).eq("id", id);
}

export async function deleteQuote(id: string): Promise<void> {
  const sb = getSupabase();
  await sb.from("quotes").delete().eq("id", id);
}
