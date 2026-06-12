import { formatMoney, groupByCategory } from "@/lib/quote";
import { TRUCK_TYPE_LABELS, type Quote, type TruckType } from "@/lib/types";

/**
 * A clean, print-ready quote "sheet". White paper styling so it looks like a
 * real document on the dark dashboard and prints/exports to PDF cleanly.
 */
export function QuoteDocument({ quote }: { quote: Quote }) {
  const q = quote.quote_data;
  const groups = groupByCategory(q.lineItems);
  const created = new Date(quote.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="print-sheet mx-auto max-w-3xl rounded-xl bg-white text-zinc-900 shadow-2xl shadow-black/40">
      <div className="p-8 sm:p-10">
        {/* Letterhead */}
        <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded bg-amber-brand text-sm font-black text-black">
                ◧
              </span>
              <span className="text-lg font-bold tracking-tight">BuildQuote Customs</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Custom Mobile Build &amp; Fabrication
            </p>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold uppercase tracking-wide text-zinc-800">
              Quote
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              #{quote.id.slice(0, 8).toUpperCase()}
            </div>
            <div className="text-xs text-zinc-500">{created}</div>
          </div>
        </div>

        {/* Parties */}
        <div className="mt-5 grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Prepared for
            </div>
            <div className="mt-1 font-semibold">
              {quote.customer_company || quote.customer_name || "Customer"}
            </div>
            {quote.customer_company && quote.customer_name ? (
              <div className="text-zinc-600">{quote.customer_name}</div>
            ) : null}
            {quote.customer_contact ? (
              <div className="text-zinc-600">{quote.customer_contact}</div>
            ) : null}
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Build
            </div>
            <div className="mt-1 font-semibold">
              {TRUCK_TYPE_LABELS[quote.truck_type as TruckType] ?? quote.truck_type}
            </div>
            {q.leadTime ? (
              <div className="text-zinc-600">Lead time: {q.leadTime}</div>
            ) : null}
          </div>
        </div>

        {q.title ? (
          <h2 className="mt-6 text-base font-semibold text-zinc-800">{q.title}</h2>
        ) : null}

        {/* Line items */}
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-300 text-left text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="py-2 font-semibold">Item</th>
              <th className="py-2 text-center font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Unit</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([category, items]) => (
              <CategoryRows
                key={category}
                category={category}
                items={items}
                currency={q.currency}
              />
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatMoney(q.subtotal, q.currency)} />
            <Row
              label={`Tax (${(q.taxRate * 100).toFixed(2)}%)`}
              value={formatMoney(q.tax, q.currency)}
            />
            <div className="flex items-center justify-between border-t-2 border-zinc-900 pt-2 text-base font-bold">
              <span>Total</span>
              <span>{formatMoney(q.total, q.currency)}</span>
            </div>
          </div>
        </div>

        {/* Notes & terms */}
        {q.notes ? (
          <div className="mt-6">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Notes
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
              {q.notes}
            </p>
          </div>
        ) : null}

        {q.terms ? (
          <div className="mt-4 rounded-lg bg-zinc-100 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Terms
            </div>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-600">
              {q.terms}
            </p>
          </div>
        ) : null}

        <p className="mt-6 text-center text-[11px] text-zinc-400">
          Thank you for the opportunity to build with you.
        </p>
      </div>
    </div>
  );
}

function CategoryRows({
  category,
  items,
  currency,
}: {
  category: string;
  items: { description: string; quantity: number; unitPrice: number }[];
  currency: string;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={4}
          className="pt-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-amber-700"
        >
          {category}
        </td>
      </tr>
      {items.map((li, i) => (
        <tr key={i} className="border-b border-zinc-100">
          <td className="py-2 pr-2 text-zinc-800">{li.description}</td>
          <td className="py-2 text-center text-zinc-600">{li.quantity}</td>
          <td className="py-2 text-right text-zinc-600">
            {formatMoney(li.unitPrice, currency)}
          </td>
          <td className="py-2 text-right font-medium text-zinc-900">
            {formatMoney(li.quantity * li.unitPrice, currency)}
          </td>
        </tr>
      ))}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-zinc-600">
      <span>{label}</span>
      <span className="font-medium text-zinc-900">{value}</span>
    </div>
  );
}
