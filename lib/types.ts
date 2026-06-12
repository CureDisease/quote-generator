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
  revisions: QuoteRevision[];
  ai_provider: string;
  ai_model: string;
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
