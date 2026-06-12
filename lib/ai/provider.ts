import type {
  AiSettings,
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
  // Active knowledge-base documents (prior quotes, emails, pricing, docs)
  // that "train" / steer the connected AI.
  knowledge: TrainingDocument[];
  settings: AiSettings;
}

export interface AiResult {
  quote: QuoteData;
  provider: string;
  model: string;
  note?: string; // optional human-readable note (e.g. "running on sample data")
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
