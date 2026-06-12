import Anthropic from "@anthropic-ai/sdk";
import type { BuildSpec, QuoteData } from "../types";
import { normalizeQuoteData } from "../quote";
import { normalizeBuildSpec, specToPromptText } from "../spec";
import {
  buildKnowledgeBlock,
  type AiResult,
  type CatalogExtractContext,
  type CatalogResult,
  type ExtractContext,
  type ExtractedCatalogItem,
  type QuoteAiProvider,
  type QuoteContext,
  type SpecResult,
} from "./provider";
import { EQUIPMENT_CATEGORIES, type EquipmentCategory } from "../types";

const DEFAULT_MODEL = "claude-fable-5";

const SCHEMA_INSTRUCTIONS = `
Return ONLY a single JSON object (no prose, no markdown fences) with exactly this shape:
{
  "title": string,
  "currency": "USD",
  "lineItems": [
    { "category": string, "description": string, "quantity": number, "unitPrice": number }
  ],
  "taxRate": number,        // decimal, e.g. 0.0825
  "leadTime": string,       // e.g. "10-12 weeks from deposit"
  "notes": string,
  "terms": string
}
Group line items by category (e.g. "Chassis & Base", "Kitchen & Equipment",
"Electrical & Power", "Plumbing", "Exterior & Graphics", "Labor",
"Permits & Misc"). Use realistic prices. Do NOT include subtotal/tax/total —
those are computed from the line items.
`.trim();

function extractJson(text: string): unknown {
  let t = text.trim();
  // strip code fences if present
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  // fall back to the first {...} block
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1) t = t.slice(first, last + 1);
  return JSON.parse(t);
}

function parseQuote(text: string): QuoteData {
  return normalizeQuoteData(extractJson(text) as Partial<QuoteData>);
}

function systemPrompt(ctx: QuoteContext): string {
  const behavior =
    ctx.settings.system_prompt?.trim() ||
    "You are an expert estimator for a company that builds custom trucks. Produce clear, itemized, realistic quotes.";
  return [
    behavior,
    "",
    "REFERENCE DOCUMENTS (the company's prior quotes, emails, pricing, and docs — match their pricing and style):",
    buildKnowledgeBlock(ctx.knowledge),
    "",
    SCHEMA_INSTRUCTIONS,
  ].join("\n");
}

function customerBlock(ctx: QuoteContext): string {
  const lines = [
    `Customer: ${ctx.customerName || "(n/a)"}`,
    `Company: ${ctx.customerCompany || "(n/a)"}`,
    `Contact: ${ctx.customerContact || "(n/a)"}`,
    `Truck type: ${ctx.truckType}`,
    `Requirements: ${ctx.requirements || "(none provided)"}`,
  ];
  if (ctx.spec) {
    lines.push(
      "",
      "STRUCTURED BUILD SPEC (extracted from the customer's documents — the quote must cover everything in it):",
      specToPromptText(ctx.spec),
    );
  }
  return lines.join("\n");
}

// ----- Build-spec extraction -------------------------------------------------

const SPEC_SCHEMA_INSTRUCTIONS = `
Return ONLY a single JSON object (no prose, no markdown fences) with exactly this shape:
{
  "summary": string,              // one short paragraph describing the build in plain language
  "truckType": "food_truck" | "coffee_truck" | "vending_truck" | "bbq_smoker_trailer" | "mobile_retail" | "other",
  "baseVehicle": string,          // e.g. "22ft step van", "8.5x20 concession trailer"
  "dimensions": { "lengthFt": number, "widthFt": number, "heightFt": number },
  "equipment": [
    {
      "name": string, "type": string, "location": string, "specs": string,
      "lengthFt": number,   // optional footprint along the wall — preserve if present
      "depthFt": number,    // optional footprint into the galley — preserve if present
      "position": { "xFt": number, "side": "street" | "curb" }  // optional explicit placement — PRESERVE if present
    }
    // type: one of "cooking" | "refrigeration" | "sink" | "prep" | "ventilation" | "storage" | "equipment"
    // location: where in/on the truck, e.g. "street-side galley", "curb-side bar", "rear"
  ],
  "power": { "generatorKw": number, "shorePower": boolean, "batteries": boolean, "solar": boolean, "notes": string },
  "plumbing": { "freshTankGal": number, "greyTankGal": number, "sinks": number, "waterHeater": boolean, "notes": string },
  "exterior": {
    "paintColor": string,
    "wrap": string,
    "servingWindows": [ { "side": "street" | "curb" | "rear" | "front", "widthIn": number } ]
  },
  "interior": { "flooring": string, "finishes": string },
  "mustHaves": [string],          // explicit customer requirements, verbatim where possible
  "openQuestions": [string]       // information that is missing or ambiguous and should be confirmed
}
Use 0 / "" / [] for anything truly not mentioned, but infer reasonable defaults
(e.g. typical dimensions for the stated vehicle) and note inferences in openQuestions.
`.trim();

function extractSystemPrompt(ctx: ExtractContext): string {
  return [
    "You are an expert estimator for a company that builds custom trucks.",
    "Read the customer's documents (emails, spec sheets, sketches) and extract a single structured build specification describing exactly what they want built.",
    "",
    "COMPANY REFERENCE DOCUMENTS (for context on typical builds and terminology):",
    buildKnowledgeBlock(ctx.knowledge),
    "",
    SPEC_SCHEMA_INSTRUCTIONS,
  ].join("\n");
}

function extractUserContent(ctx: ExtractContext): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];
  const intro = [
    "Extract the build spec for this customer.",
    "",
    `Customer: ${ctx.customerName || "(n/a)"}`,
    `Company: ${ctx.customerCompany || "(n/a)"}`,
    `Truck type selected on the intake form: ${ctx.truckType}`,
    ctx.requirements
      ? `Notes typed by our estimator:\n${ctx.requirements}`
      : "(No typed notes — rely on the attached documents.)",
  ].join("\n");
  blocks.push({ type: "text", text: intro });

  for (const doc of ctx.documents) {
    if (doc.media?.kind === "pdf") {
      blocks.push({ type: "text", text: `--- Attached document: ${doc.filename}` });
      blocks.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: doc.media.base64,
        },
      });
    } else if (doc.media?.kind === "image") {
      blocks.push({ type: "text", text: `--- Attached image: ${doc.filename}` });
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: doc.media.mediaType as
            | "image/png"
            | "image/jpeg"
            | "image/gif"
            | "image/webp",
          data: doc.media.base64,
        },
      });
    } else if (doc.text) {
      blocks.push({
        type: "text",
        text: `--- Document: ${doc.filename}\n${doc.text}`,
      });
    }
  }
  return blocks;
}

function parseSpec(text: string, ctx: ExtractContext): SpecResult["spec"] {
  return normalizeBuildSpec(
    extractJson(text) as Partial<BuildSpec>,
    ctx.truckType,
  );
}

function createClient(ctx: {
  settings: { base_url?: string };
}): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to the environment to use the Claude provider.",
    );
  }
  const baseURL = ctx.settings.base_url?.trim() || undefined;
  return new Anthropic({ apiKey, baseURL });
}

// User content sent to the model: plain text or a list of content blocks
// (text + native PDF/image documents).
type UserContent = string | Anthropic.ContentBlockParam[];

async function complete(
  client: Anthropic,
  model: string,
  system: string,
  userContent: UserContent,
): Promise<string> {
  const res = await client.messages.create({
    model,
    max_tokens: 8000,
    system,
    messages: [{ role: "user", content: userContent }],
  });
  if (res.stop_reason === "refusal") {
    throw new Error(
      "The AI declined to process this request. Review the inputs and try again.",
    );
  }
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// ----- Catalog extraction ----------------------------------------------------

const CATALOG_SCHEMA_INSTRUCTIONS = `
Return ONLY a single JSON object (no prose, no markdown fences) with this shape:
{ "items": [
  {
    "name": string,             // canonical equipment name, e.g. "6-burner range + oven"
    "category": "cooking" | "refrigeration" | "sink" | "prep" | "ventilation" | "storage" | "equipment",
    "length_ft": number,        // footprint along the galley wall
    "depth_ft": number,         // footprint into the galley
    "height_ft": number,
    "unit_price": number,       // USD, from the company's own pricing where present
    "power_watts": number,      // electrical draw, 0 for gas/none
    "tags": [string],
    "notes": string
  }
] }
Extract DISTINCT equipment items only (not labor, permits, or whole builds).
Prefer prices found in the documents. Use realistic dimensions. Skip items
already present in the existing catalog list.
`.trim();

function catalogSystemPrompt(ctx: CatalogExtractContext): string {
  return [
    "You build an equipment catalog for a custom-truck fabrication shop.",
    "Read the company's reference documents (pricing sheets, prior quotes, specs) and extract the distinct pieces of equipment they install, with the company's own prices and realistic physical dimensions.",
    "",
    "REFERENCE DOCUMENTS:",
    buildKnowledgeBlock(ctx.knowledge),
    "",
    `ALREADY IN CATALOG (do not repeat these): ${
      ctx.existingNames.length ? ctx.existingNames.join(", ") : "(none)"
    }`,
    "",
    CATALOG_SCHEMA_INSTRUCTIONS,
  ].join("\n");
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseCatalog(text: string): ExtractedCatalogItem[] {
  const raw = extractJson(text) as { items?: unknown };
  const items = Array.isArray(raw.items) ? raw.items : [];
  return items
    .map((it): ExtractedCatalogItem => {
      const o = (it ?? {}) as Record<string, unknown>;
      const category = (
        EQUIPMENT_CATEGORIES as readonly string[]
      ).includes(String(o.category))
        ? (o.category as EquipmentCategory)
        : "equipment";
      return {
        name: String(o.name ?? "").trim(),
        category,
        length_ft: num(o.length_ft, 3),
        depth_ft: num(o.depth_ft, 2.2),
        height_ft: num(o.height_ft, 3),
        unit_price: num(o.unit_price, 0),
        power_watts: num(o.power_watts, 0),
        tags: Array.isArray(o.tags)
          ? o.tags.map((t) => String(t).trim()).filter(Boolean)
          : [],
        notes: String(o.notes ?? "").trim(),
      };
    })
    .filter((i) => i.name.length > 0);
}

export const anthropicProvider: QuoteAiProvider = {
  name: "anthropic",

  async extractCatalog(ctx: CatalogExtractContext): Promise<CatalogResult> {
    const client = createClient(ctx);
    const model = ctx.settings.model?.trim() || DEFAULT_MODEL;
    const text = await complete(
      client,
      model,
      catalogSystemPrompt(ctx),
      "Extract the equipment catalog from the reference documents.",
    );
    return { items: parseCatalog(text), provider: "anthropic", model };
  },

  async extractSpec(ctx: ExtractContext): Promise<SpecResult> {
    const client = createClient(ctx);
    const model = ctx.settings.model?.trim() || DEFAULT_MODEL;
    const text = await complete(
      client,
      model,
      extractSystemPrompt(ctx),
      extractUserContent(ctx),
    );
    return { spec: parseSpec(text, ctx), provider: "anthropic", model };
  },

  async editSpec(current, instruction, ctx): Promise<SpecResult> {
    const client = createClient(ctx);
    const model = ctx.settings.model?.trim() || DEFAULT_MODEL;
    const system = [
      "You are an expert estimator editing a structured truck build specification.",
      "Apply the requested change and return the COMPLETE updated spec.",
      "Preserve every field and each equipment item's existing `position` { xFt, side } and `lengthFt`/`depthFt` unless the change is specifically about moving, adding, or removing equipment.",
      "",
      "REFERENCE DOCUMENTS (for pricing/terminology):",
      buildKnowledgeBlock(ctx.knowledge),
      "",
      SPEC_SCHEMA_INSTRUCTIONS,
    ].join("\n");
    const text = await complete(
      client,
      model,
      system,
      [
        "Current spec JSON:",
        JSON.stringify(current, null, 2),
        "",
        `Requested change: ${instruction}`,
      ].join("\n"),
    );
    return {
      spec: normalizeBuildSpec(extractJson(text) as Partial<BuildSpec>, ctx.truckType),
      provider: "anthropic",
      model,
    };
  },

  async generate(ctx: QuoteContext): Promise<AiResult> {
    const client = createClient(ctx);
    const model = ctx.settings.model?.trim() || DEFAULT_MODEL;
    const text = await complete(
      client,
      model,
      systemPrompt(ctx),
      `Create a detailed quote for this customer.\n\n${customerBlock(ctx)}`,
    );
    return { quote: parseQuote(text), provider: "anthropic", model };
  },

  async refine(current, instruction, ctx): Promise<AiResult> {
    const client = createClient(ctx);
    const model = ctx.settings.model?.trim() || DEFAULT_MODEL;
    const text = await complete(
      client,
      model,
      systemPrompt(ctx),
      [
        "Here is the current quote JSON:",
        JSON.stringify(current, null, 2),
        "",
        `Apply this requested change and return the full updated quote JSON: ${instruction}`,
        "",
        `Context:\n${customerBlock(ctx)}`,
      ].join("\n"),
    );
    return { quote: parseQuote(text), provider: "anthropic", model };
  },
};
