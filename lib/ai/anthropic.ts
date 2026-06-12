import Anthropic from "@anthropic-ai/sdk";
import type { QuoteData } from "../types";
import { normalizeQuoteData } from "../quote";
import {
  buildKnowledgeBlock,
  type AiResult,
  type QuoteAiProvider,
  type QuoteContext,
} from "./provider";

const DEFAULT_MODEL = "claude-opus-4-8";

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
  return [
    `Customer: ${ctx.customerName || "(n/a)"}`,
    `Company: ${ctx.customerCompany || "(n/a)"}`,
    `Contact: ${ctx.customerContact || "(n/a)"}`,
    `Truck type: ${ctx.truckType}`,
    `Requirements: ${ctx.requirements || "(none provided)"}`,
  ].join("\n");
}

function createClient(ctx: QuoteContext): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to the environment to use the Claude provider.",
    );
  }
  const baseURL = ctx.settings.base_url?.trim() || undefined;
  return new Anthropic({ apiKey, baseURL });
}

async function complete(
  client: Anthropic,
  model: string,
  system: string,
  userText: string,
): Promise<string> {
  const res = await client.messages.create({
    model,
    max_tokens: 8000,
    system,
    messages: [{ role: "user", content: userText }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

export const anthropicProvider: QuoteAiProvider = {
  name: "anthropic",

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
