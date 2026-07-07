import type {
  AiSettings,
  BuildSpec,
  CatalogItem,
  QuoteData,
  TrainingDocument,
  TruckType,
} from "../types";

// The request the framework hands to whichever AI provider is connected.
export interface QuoteContext {
  customerName: string;
  customerCompany: string;
  customerContact: string;
  truckType: TruckType;
  requirements: string;
  // Structured build spec (extracted from uploaded documents), when available,
  // so the generated quote reflects it.
  spec?: BuildSpec;
  // Active knowledge-base documents (prior quotes, emails, pricing, docs)
  // that "train" / steer the connected AI.
  knowledge: TrainingDocument[];
  settings: AiSettings;
}

// A single uploaded document handed to the extractor: either extracted text or
// a Claude-native media block (PDF / image).
export interface ExtractDoc {
  filename: string;
  text: string;
  media?: { kind: "pdf" | "image"; base64: string; mediaType: string };
}

// The request for turning uploaded customer documents into a structured spec.
export interface ExtractContext {
  customerName: string;
  customerCompany: string;
  customerContact: string;
  truckType: TruckType;
  requirements: string; // any free-text the estimator typed alongside uploads
  documents: ExtractDoc[];
  knowledge: TrainingDocument[];
  settings: AiSettings;
}

export interface AiResult {
  quote: QuoteData;
  provider: string;
  model: string;
  note?: string; // optional human-readable note (e.g. "running on sample data")
}

export interface SpecResult {
  spec: BuildSpec;
  provider: string;
  model: string;
  note?: string;
}

// A catalog item proposed by extraction — id/timestamps/source assigned on save.
export type ExtractedCatalogItem = Pick<
  CatalogItem,
  | "name"
  | "category"
  | "length_ft"
  | "depth_ft"
  | "height_ft"
  | "unit_price"
  | "power_watts"
  | "tags"
  | "notes"
>;

export interface CatalogExtractContext {
  knowledge: TrainingDocument[];
  // Names already in the catalog so the AI extends rather than repeats.
  existingNames: string[];
  settings: AiSettings;
}

export interface CatalogResult {
  items: ExtractedCatalogItem[];
  provider: string;
  model: string;
  note?: string;
}

/**
 * Every AI integration implements this. Swapping the model the company "trains"
 * and uses is a matter of adding one of these and selecting it in settings —
 * nothing else in the dashboard changes.
 */
export interface QuoteAiProvider {
  readonly name: string;
  generate(ctx: QuoteContext): Promise<AiResult>;
  refine(
    current: QuoteData,
    instruction: string,
    ctx: QuoteContext,
  ): Promise<AiResult>;
  // Read uploaded customer documents and produce a structured build spec.
  extractSpec(ctx: ExtractContext): Promise<SpecResult>;
  // Apply a natural-language change to an existing spec (the builder AI box).
  editSpec(
    current: BuildSpec,
    instruction: string,
    ctx: { truckType: TruckType; knowledge: TrainingDocument[]; settings: AiSettings },
  ): Promise<SpecResult>;
  // Read the knowledge base (pricing sheets, prior quotes) and extract
  // distinct equipment items for the builder's gallery catalog.
  extractCatalog(ctx: CatalogExtractContext): Promise<CatalogResult>;
  // Turn a media document (PDF / image) into plain text for the knowledge
  // base. Returns "" when the provider can't read media.
  transcribe(doc: ExtractDoc, settings: AiSettings): Promise<string>;
}

// Builds the reference-context block from active knowledge documents.
export function buildKnowledgeBlock(knowledge: TrainingDocument[]): string {
  if (!knowledge.length) return "(No reference documents provided yet.)";
  return knowledge
    .map((d, i) => {
      const tags = d.tags?.length ? ` [tags: ${d.tags.join(", ")}]` : "";
      return `--- Reference #${i + 1} · ${d.doc_type}${tags}\nTitle: ${d.title}\n${d.content}`;
    })
    .join("\n\n");
}
