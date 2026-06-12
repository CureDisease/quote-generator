import type { LineItem, QuoteData } from "./types";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Recompute subtotal / tax / total from line items so the numbers are always
 * internally consistent, regardless of what the AI returned.
 */
export function recomputeTotals(
  lineItems: LineItem[],
  taxRate: number,
): Pick<QuoteData, "subtotal" | "tax" | "total"> {
  const subtotal = round2(
    lineItems.reduce(
      (sum, li) => sum + (Number(li.quantity) || 0) * (Number(li.unitPrice) || 0),
      0,
    ),
  );
  const tax = round2(subtotal * (Number(taxRate) || 0));
  const total = round2(subtotal + tax);
  return { subtotal, tax, total };
}

export function normalizeQuoteData(raw: Partial<QuoteData>): QuoteData {
  const currency = raw.currency || "USD";
  const taxRate = typeof raw.taxRate === "number" ? raw.taxRate : 0.0825;
  const lineItems: LineItem[] = Array.isArray(raw.lineItems)
    ? raw.lineItems.map((li) => ({
        category: String(li.category ?? "General"),
        description: String(li.description ?? ""),
        quantity: Number(li.quantity) || 0,
        unitPrice: Number(li.unitPrice) || 0,
      }))
    : [];
  const totals = recomputeTotals(lineItems, taxRate);
  return {
    title: raw.title || "Custom Truck Build — Quote",
    currency,
    lineItems,
    taxRate,
    leadTime: raw.leadTime || "",
    notes: raw.notes || "",
    terms: raw.terms || "",
    ...totals,
  };
}

export function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch {
    return `$${(amount || 0).toFixed(2)}`;
  }
}

export function groupByCategory(lineItems: LineItem[]): [string, LineItem[]][] {
  const order: string[] = [];
  const map = new Map<string, LineItem[]>();
  for (const li of lineItems) {
    const key = li.category || "General";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(li);
  }
  return order.map((k) => [k, map.get(k)!]);
}
