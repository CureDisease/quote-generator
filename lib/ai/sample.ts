import type { BuildSpec, LineItem, QuoteData, TruckType } from "../types";
import { normalizeQuoteData } from "../quote";
import { normalizeBuildSpec } from "../spec";
import type {
  AiResult,
  CatalogExtractContext,
  CatalogResult,
  ExtractContext,
  ExtractedCatalogItem,
  QuoteAiProvider,
  QuoteContext,
  SpecResult,
} from "./provider";

// Common equipment the sample extractor can recognize in knowledge-base text,
// with rough dimensions/prices so the gallery is usable before an AI is connected.
const CATALOG_KEYWORDS: (ExtractedCatalogItem & { match: RegExp })[] = [
  { match: /flat[\s-]?top|griddle/i, name: "Flat-top griddle", category: "cooking", length_ft: 3, depth_ft: 2.2, height_ft: 1.5, unit_price: 2200, power_watts: 0, tags: ["gas"], notes: "" },
  { match: /\bfryer\b/i, name: "Deep fryer", category: "cooking", length_ft: 1.5, depth_ft: 2.2, height_ft: 3, unit_price: 1600, power_watts: 0, tags: ["gas"], notes: "" },
  { match: /6[\s-]?burner|range\b/i, name: "6-burner range + oven", category: "cooking", length_ft: 3, depth_ft: 2.4, height_ft: 3, unit_price: 3800, power_watts: 0, tags: ["gas"], notes: "" },
  { match: /char[\s-]?broiler|char grill/i, name: "Charbroiler", category: "cooking", length_ft: 2, depth_ft: 2.2, height_ft: 1.5, unit_price: 1900, power_watts: 0, tags: ["gas"], notes: "" },
  { match: /vent hood|exhaust hood|hood\b/i, name: "Commercial vent hood", category: "ventilation", length_ft: 6, depth_ft: 2.5, height_ft: 1.2, unit_price: 6900, power_watts: 600, tags: ["fire-suppression"], notes: "" },
  { match: /reach[\s-]?in|refrigerator|fridge/i, name: "Reach-in refrigerator", category: "refrigeration", length_ft: 2.5, depth_ft: 2.6, height_ft: 6.5, unit_price: 3400, power_watts: 800, tags: [], notes: "" },
  { match: /freezer/i, name: "Reach-in freezer", category: "refrigeration", length_ft: 2.5, depth_ft: 2.6, height_ft: 6.5, unit_price: 3900, power_watts: 1000, tags: [], notes: "" },
  { match: /under[\s-]?counter (fridge|refrigerat)/i, name: "Undercounter refrigeration", category: "refrigeration", length_ft: 3, depth_ft: 2.4, height_ft: 3, unit_price: 2600, power_watts: 600, tags: [], notes: "" },
  { match: /3[\s-]?comp|three[\s-]?comp|compartment sink/i, name: "3-compartment sink", category: "sink", length_ft: 4, depth_ft: 2, height_ft: 3, unit_price: 1400, power_watts: 0, tags: [], notes: "" },
  { match: /hand[\s-]?sink|hand wash/i, name: "Hand sink", category: "sink", length_ft: 1.2, depth_ft: 1.2, height_ft: 3, unit_price: 350, power_watts: 0, tags: [], notes: "" },
  { match: /prep table|stainless table|work table/i, name: "Stainless prep table", category: "prep", length_ft: 4, depth_ft: 2.2, height_ft: 3, unit_price: 700, power_watts: 0, tags: [], notes: "" },
  { match: /espresso/i, name: "Dual-group espresso machine", category: "cooking", length_ft: 2.5, depth_ft: 2, height_ft: 1.5, unit_price: 9500, power_watts: 3000, tags: ["electric"], notes: "" },
  { match: /grinder/i, name: "Coffee grinder", category: "prep", length_ft: 0.7, depth_ft: 0.7, height_ft: 1.5, unit_price: 800, power_watts: 500, tags: ["electric"], notes: "" },
  { match: /generator/i, name: "Onboard generator", category: "equipment", length_ft: 2.5, depth_ft: 2, height_ft: 2, unit_price: 6200, power_watts: 0, tags: ["power"], notes: "" },
];

function sampleCatalogFromKnowledge(
  ctx: CatalogExtractContext,
): ExtractedCatalogItem[] {
  const text = ctx.knowledge
    .map((d) => d.content)
    .join("\n")
    .toLowerCase();
  const have = new Set(ctx.existingNames.map((n) => n.toLowerCase()));
  const out: ExtractedCatalogItem[] = [];
  for (const k of CATALOG_KEYWORDS) {
    if (!k.match.test(text)) continue;
    if (have.has(k.name.toLowerCase())) continue;
    const { match, ...item } = k;
    void match;
    out.push(item);
  }
  return out;
}

// Rough base build-out templates per truck type. This is intentionally simple,
// deterministic placeholder logic so the dashboard's full flow works BEFORE a
// real AI is connected. The connected provider replaces this entirely.
const BASE_BUILDS: Record<string, LineItem[]> = {
  food_truck: [
    { category: "Chassis & Base", description: "Step-van chassis (reconditioned)", quantity: 1, unitPrice: 28000 },
    { category: "Chassis & Base", description: "Interior framing, insulation & FRP walls", quantity: 1, unitPrice: 9500 },
    { category: "Kitchen & Equipment", description: "Stainless prep tables & shelving", quantity: 1, unitPrice: 4200 },
    { category: "Kitchen & Equipment", description: "6-burner range + oven", quantity: 1, unitPrice: 3800 },
    { category: "Kitchen & Equipment", description: "Commercial vent hood + fire suppression", quantity: 1, unitPrice: 6900 },
    { category: "Kitchen & Equipment", description: "Refrigeration (reach-in + undercounter)", quantity: 1, unitPrice: 5400 },
    { category: "Electrical & Power", description: "Onboard generator (7kW) + transfer switch", quantity: 1, unitPrice: 6200 },
    { category: "Electrical & Power", description: "Wiring, panel, outlets & LED lighting", quantity: 1, unitPrice: 3800 },
    { category: "Plumbing", description: "Fresh/grey water tanks, 3-comp sink, water heater", quantity: 1, unitPrice: 3600 },
    { category: "Exterior & Graphics", description: "Service window, paint & full vinyl wrap", quantity: 1, unitPrice: 5200 },
    { category: "Labor", description: "Build-out labor & project management", quantity: 1, unitPrice: 14000 },
    { category: "Permits & Misc", description: "Health/fire compliance prep & documentation", quantity: 1, unitPrice: 1800 },
  ],
  coffee_truck: [
    { category: "Chassis & Base", description: "Compact van chassis (reconditioned)", quantity: 1, unitPrice: 24000 },
    { category: "Chassis & Base", description: "Interior framing, insulation & FRP walls", quantity: 1, unitPrice: 8000 },
    { category: "Kitchen & Equipment", description: "Dual-group espresso machine", quantity: 1, unitPrice: 9500 },
    { category: "Kitchen & Equipment", description: "Grinders, knock box & bar build", quantity: 1, unitPrice: 3200 },
    { category: "Kitchen & Equipment", description: "Under-counter refrigeration", quantity: 1, unitPrice: 2600 },
    { category: "Electrical & Power", description: "Generator (5kW) + transfer switch", quantity: 1, unitPrice: 5200 },
    { category: "Electrical & Power", description: "Wiring, panel & LED lighting", quantity: 1, unitPrice: 3200 },
    { category: "Plumbing", description: "Water tanks, sink & water heater", quantity: 1, unitPrice: 3200 },
    { category: "Exterior & Graphics", description: "Service window, paint & vinyl wrap", quantity: 1, unitPrice: 4600 },
    { category: "Labor", description: "Build-out labor & project management", quantity: 1, unitPrice: 11000 },
    { category: "Permits & Misc", description: "Compliance prep & documentation", quantity: 1, unitPrice: 1500 },
  ],
};

function baseFor(truckType: string): LineItem[] {
  const base = BASE_BUILDS[truckType] ?? BASE_BUILDS.food_truck;
  // clone so we never mutate the template
  return base.map((li) => ({ ...li }));
}

function buildQuote(ctx: QuoteContext, extra: LineItem[] = []): QuoteData {
  const items = [...baseFor(ctx.truckType), ...extra];
  const who = ctx.customerCompany || ctx.customerName || "Customer";
  return normalizeQuoteData({
    title: `Custom Build Quote — ${who}`,
    currency: "USD",
    lineItems: items,
    taxRate: 0.0825,
    leadTime: "10–12 weeks from deposit",
    notes:
      "Generated by the built-in sample estimator. Connect an AI provider on the Knowledge & Training page to produce quotes from your own pricing, prior quotes, and behavior instructions. Customer request on file: " +
      (ctx.requirements ? `“${ctx.requirements}”` : "(none provided)"),
    terms:
      "50% deposit to schedule the build, 40% at mid-build milestone, 10% on delivery. Quote valid for 30 days. Final pricing confirmed after design sign-off.",
  });
}

// Rough starting points per build type for the sample extractor.
const SPEC_TEMPLATES: Record<string, Partial<BuildSpec>> = {
  food_truck: {
    baseVehicle: "20ft step van",
    dimensions: { lengthFt: 20, widthFt: 8, heightFt: 9.5 },
    equipment: [
      { name: "Flat-top griddle", type: "cooking", location: "street-side galley", specs: "" },
      { name: "6-burner range + oven", type: "cooking", location: "street-side galley", specs: "" },
      { name: "Commercial vent hood", type: "ventilation", location: "over cook line", specs: "with fire suppression" },
      { name: "Reach-in refrigerator", type: "refrigeration", location: "rear", specs: "" },
      { name: "3-compartment sink", type: "sink", location: "curb-side", specs: "" },
    ],
    power: { generatorKw: 7, shorePower: true, batteries: false, solar: false, notes: "" },
    plumbing: { freshTankGal: 40, greyTankGal: 45, sinks: 2, waterHeater: true, notes: "" },
    exterior: { paintColor: "", accentColor: "", wrap: "Full vinyl wrap", servingWindows: [{ side: "curb", widthIn: 48 }], decals: [] },
  },
  coffee_truck: {
    baseVehicle: "Compact van",
    dimensions: { lengthFt: 18, widthFt: 7.5, heightFt: 9 },
    equipment: [
      { name: "Dual-group espresso machine", type: "cooking", location: "curb-side bar", specs: "" },
      { name: "Coffee grinders", type: "prep", location: "curb-side bar", specs: "" },
      { name: "Under-counter refrigeration", type: "refrigeration", location: "under bar", specs: "" },
      { name: "Hand sink + prep sink", type: "sink", location: "curb-side", specs: "" },
    ],
    power: { generatorKw: 5, shorePower: true, batteries: false, solar: false, notes: "" },
    plumbing: { freshTankGal: 30, greyTankGal: 32, sinks: 2, waterHeater: true, notes: "" },
    exterior: { paintColor: "", accentColor: "", wrap: "Vinyl wrap", servingWindows: [{ side: "curb", widthIn: 40 }], decals: [] },
  },
};

function starterSpec(ctx: ExtractContext): BuildSpec {
  const tmpl = SPEC_TEMPLATES[ctx.truckType] ?? SPEC_TEMPLATES.food_truck;
  const docText = ctx.documents
    .map((d) => d.text)
    .filter(Boolean)
    .join("\n\n")
    .trim();
  const mediaCount = ctx.documents.filter((d) => d.media).length;
  const summaryBits = [ctx.requirements.trim(), docText].filter(Boolean);
  const summary =
    summaryBits.join(" ").slice(0, 600) ||
    `Starter ${ctx.truckType.replace("_", " ")} spec — connect an AI provider to extract details from uploads.`;

  const openQuestions = [
    "Confirm exact dimensions and base vehicle.",
    "Confirm equipment list and placement with the customer.",
  ];
  if (mediaCount > 0) {
    openQuestions.push(
      `${mediaCount} uploaded file(s) (PDF/image) were not read — connect the AI provider to extract them.`,
    );
  }

  return normalizeBuildSpec(
    {
      ...tmpl,
      truckType: ctx.truckType as TruckType,
      summary,
      mustHaves: ctx.requirements.trim() ? [ctx.requirements.trim()] : [],
      openQuestions,
    },
    ctx.truckType as TruckType,
  );
}

/**
 * The framework's default provider. Produces a realistic, fully-structured
 * quote with zero external dependencies so the dashboard is usable end-to-end
 * before any AI is connected.
 */
export const sampleProvider: QuoteAiProvider = {
  name: "sample",

  async extractSpec(ctx: ExtractContext): Promise<SpecResult> {
    return {
      spec: starterSpec(ctx),
      provider: "sample",
      model: "built-in-estimator",
      note: "Sample extractor produced a starter spec from the build type. Connect an AI provider to read your uploaded documents.",
    };
  },

  async editSpec(current, instruction): Promise<SpecResult> {
    // Without a connected AI, record the request so the loop is visible.
    const spec = normalizeBuildSpec(
      {
        ...current,
        openQuestions: [
          ...current.openQuestions,
          `Requested change (needs connected AI to apply): ${instruction}`,
        ],
      },
      current.truckType,
    );
    return {
      spec,
      provider: "sample",
      model: "built-in-estimator",
      note: "Sample estimator logged your change. Connect an AI provider to apply spec edits automatically.",
    };
  },

  async extractCatalog(ctx: CatalogExtractContext): Promise<CatalogResult> {
    const items = sampleCatalogFromKnowledge(ctx);
    return {
      items,
      provider: "sample",
      model: "built-in-estimator",
      note: items.length
        ? "Sample extractor matched common equipment in your knowledge base. Connect an AI provider for full extraction with your real prices."
        : "No common equipment recognized. Add knowledge-base documents (pricing sheets, prior quotes) or add catalog items manually.",
    };
  },

  async generate(ctx: QuoteContext): Promise<AiResult> {
    return {
      quote: buildQuote(ctx),
      provider: "sample",
      model: "built-in-estimator",
      note: "Sample estimator — connect an AI provider to generate from your own data.",
    };
  },

  async refine(current, instruction, ctx): Promise<AiResult> {
    // Lightweight, transparent refinement: append the request as an
    // adjustment line so the user can see the loop working without an AI.
    const items: LineItem[] = [
      ...current.lineItems,
      {
        category: "Adjustments",
        description: `Requested change: ${instruction}`,
        quantity: 1,
        unitPrice: 0,
      },
    ];
    const quote = normalizeQuoteData({ ...current, lineItems: items });
    return {
      quote,
      provider: "sample",
      model: "built-in-estimator",
      note: "Sample estimator logged your change request. A connected AI would re-price the quote here.",
    };
  },
};
