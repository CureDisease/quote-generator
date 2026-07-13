// Shared domain types for the truck quote dashboard.

export type QuoteStatus = "draft" | "revised" | "sent" | "accepted" | "archived";

export type TruckType =
  | "food_truck"
  | "coffee_truck"
  | "vending_truck"
  | "bbq_smoker_trailer"
  | "mobile_retail"
  | "other";

export interface LineItem {
  category: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface QuoteData {
  title: string;
  currency: string; // e.g. "USD"
  lineItems: LineItem[];
  subtotal: number;
  taxRate: number; // e.g. 0.0825
  tax: number;
  total: number;
  leadTime: string; // e.g. "10-12 weeks"
  notes: string;
  terms: string;
}

export interface QuoteRevision {
  at: string; // ISO timestamp
  request: string;
  summary: string;
}

// One entry in a quote's activity timeline.
export interface QuoteActivity {
  at: string; // ISO timestamp
  kind: "created" | "spec_updated" | "generated" | "refined" | "status" | "share" | "sales";
  detail: string;
}

export interface Quote {
  id: string;
  created_at: string;
  updated_at: string;
  status: QuoteStatus;
  customer_name: string;
  customer_company: string;
  customer_contact: string;
  truck_type: TruckType;
  requirements: string;
  quote_data: QuoteData;
  build_spec: BuildSpec;
  vehicle_model_id: string | null;
  sales_notes: string;
  follow_up_at: string | null; // ISO timestamp for the next follow-up
  activity: QuoteActivity[];
  revisions: QuoteRevision[];
  ai_provider: string;
  ai_model: string;
}

// ----- Build spec -----------------------------------------------------------
// Structured representation of what the customer wants, extracted by the AI
// from uploaded documents/emails. Drives both the quote and (Phase 3) the 3D
// configurator, so the picture always matches the numbers.

// Explicit placement of an item in the galley, set in the builder. xFt is the
// center distance from the FRONT wall along the length; side is which wall.
export interface ItemPlacement {
  xFt: number;
  side: "street" | "curb";
}

export interface SpecEquipment {
  name: string; // e.g. "Flat-top griddle"
  type: string; // e.g. "cooking" | "refrigeration" | "sink" | "prep" | ...
  location: string; // e.g. "street-side galley", "rear"
  specs: string; // free-form notes (size, fuel, capacity)
  // Footprint along the wall / into the galley (from the catalog). Optional —
  // defaults applied by the scene builder when absent.
  lengthFt?: number;
  depthFt?: number;
  // Explicit position set via the builder; auto-packed when absent.
  position?: ItemPlacement;
}

export type ServingWindowSide = "street" | "curb" | "rear" | "front";

export interface ServingWindow {
  side: ServingWindowSide;
  widthIn: number; // approximate opening width in inches
}

export interface BuildSpec {
  summary: string; // one-paragraph plain-language summary of the build
  truckType: TruckType;
  baseVehicle: string; // e.g. "22ft step van", "concession trailer"
  dimensions: {
    lengthFt: number;
    widthFt: number;
    heightFt: number;
  };
  equipment: SpecEquipment[];
  power: {
    generatorKw: number; // 0 if none
    shorePower: boolean;
    batteries: boolean;
    solar: boolean;
    notes: string;
  };
  plumbing: {
    freshTankGal: number;
    greyTankGal: number;
    sinks: number;
    waterHeater: boolean;
    notes: string;
  };
  exterior: {
    paintColor: string;
    accentColor: string; // optional hex/word for a secondary color
    wrap: string; // description of wrap / graphics
    servingWindows: ServingWindow[];
    decals: Decal[]; // logos / graphics placed on the body
  };
  interior: {
    flooring: string;
    finishes: string;
  };
  mustHaves: string[]; // explicit customer requirements
  openQuestions: string[]; // gaps the estimator should clarify
}

// A logo/graphic placed on a body side, positioned in feet.
export interface Decal {
  id: string;
  url: string; // public image URL
  side: "street" | "curb" | "rear" | "front";
  xFt: number; // center distance from the front of the body (along length)
  heightFt: number; // center height above the ground
  widthFt: number; // rendered width on the panel
  aspect: number; // height / width of the source image
  label: string;
}

export interface BuildDocument {
  id: string;
  created_at: string;
  quote_id: string | null;
  filename: string;
  mime_type: string;
  storage_path: string;
  size_bytes: number;
  extracted_text: string;
}

// ----- Equipment catalog ------------------------------------------------------

export const EQUIPMENT_CATEGORIES = [
  "cooking",
  "refrigeration",
  "sink",
  "prep",
  "ventilation",
  "storage",
  "equipment",
] as const;

export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

export interface CatalogItem {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  category: EquipmentCategory;
  length_ft: number; // along the wall
  depth_ft: number; // into the galley
  height_ft: number;
  unit_price: number;
  power_watts: number; // 0 = no electrical load
  weight_lbs: number; // installed weight, 0 = unknown
  tags: string[];
  notes: string;
  source: "manual" | "extracted";
  active: boolean;
}

// ----- Vehicle models & workshop mods ----------------------------------------

// A panel zone where the shop can cut openings (serving window, door, hatch).
export interface CutZone {
  side: "street" | "curb" | "rear" | "front" | "roof";
  label: string;
  maxWidthIn: number;
}

export interface VehicleModel {
  id: string;
  created_at: string;
  updated_at: string;
  label: string;
  make: string;
  model: string;
  variant: string;
  is_trailer: boolean;
  length_ft: number;
  width_ft: number;
  height_ft: number;
  cab_length_ft: number;
  wheelbase_ft: number;
  axle_positions: number[]; // ft from front of body to each axle center
  gvwr_lbs: number;
  curb_weight_lbs: number; // empty vehicle weight; payload = GVWR - curb
  cut_zones: CutZone[];
  notes: string;
  active: boolean;
}

export const MOD_CATEGORIES = [
  "exterior",
  "structural",
  "utility",
  "finish",
] as const;
export type ModCategory = (typeof MOD_CATEGORIES)[number];

export interface WorkshopMod {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  category: ModCategory;
  unit_price: number;
  labor_hours: number;
  allowed_zones: string[];
  notes: string;
  active: boolean;
}

export type DocType = "quote" | "email" | "pricing" | "documentation";

export interface TrainingDocument {
  id: string;
  created_at: string;
  title: string;
  doc_type: DocType;
  content: string;
  tags: string[];
  active: boolean;
}

export type AiProviderName = "sample" | "anthropic" | "openai" | "custom";

export interface AiSettings {
  id: string;
  updated_at: string;
  provider: AiProviderName;
  model: string;
  base_url: string;
  system_prompt: string;
  temperature: number;
  extra: Record<string, unknown>;
}

export const TRUCK_TYPE_LABELS: Record<TruckType, string> = {
  food_truck: "Food Truck",
  coffee_truck: "Coffee / Espresso Truck",
  vending_truck: "Vending Truck",
  bbq_smoker_trailer: "BBQ / Smoker Trailer",
  mobile_retail: "Mobile Retail",
  other: "Other Custom Build",
};

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  quote: "Prior Quote",
  email: "Email",
  pricing: "Pricing Sheet",
  documentation: "Documentation",
};
