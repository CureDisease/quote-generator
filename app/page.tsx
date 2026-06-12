import Link from "next/link";
import { listQuotes, getSettings } from "@/lib/data";
import { formatMoney } from "@/lib/quote";
import { TRUCK_TYPE_LABELS, type TruckType } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-300 ring-zinc-400/20",
  revised: "bg-blue-500/15 text-blue-300 ring-blue-400/20",
  sent: "bg-amber-500/15 text-amber-300 ring-amber-400/20",
  accepted: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/20",
  archived: "bg-zinc-700/30 text-zinc-400 ring-zinc-500/20",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${cls}`}
    >
      {status}
    </span>
  );
}

export default async function DashboardPage() {
  const [quotes, settings] = await Promise.all([listQuotes(), getSettings()]);
  const connected = settings.provider !== "sample";

  const totalValue = quotes.reduce((s, q) => s + (q.quote_data?.total ?? 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quote Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Draft AI-assisted quotes for custom truck builds, refine them, and export a PDF.
          </p>
        </div>
        <Link
          href="/quotes/new"
          className="rounded-md bg-amber-brand px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
        >
          + New Quote
        </Link>
      </div>

      {/* AI status banner */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
          connected
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
            : "border-amber-500/30 bg-amber-500/10 text-amber-100"
        }`}
      >
        <span>
          {connected ? (
            <>
              <strong>AI connected:</strong> {settings.provider}
              {settings.model ? ` · ${settings.model}` : ""}
            </>
          ) : (
            <>
              <strong>Framework mode.</strong> Running the built-in sample estimator — connect
              your AI provider and upload training material to generate from your own data.
            </>
          )}
        </span>
        <Link href="/knowledge" className="font-semibold underline underline-offset-2">
          Knowledge &amp; Training →
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Quotes" value={String(quotes.length)} />
        <Stat label="Pipeline value" value={formatMoney(totalValue)} />
        <Stat
          label="Accepted"
          value={String(quotes.filter((q) => q.status === "accepted").length)}
        />
      </div>

      {/* Quote list */}
      {quotes.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-ink-soft/60 p-10 text-center">
          <p className="text-zinc-300">No quotes yet.</p>
          <Link
            href="/quotes/new"
            className="mt-4 inline-block rounded-md bg-amber-brand px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
          >
            Create your first quote
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-ink-soft/60">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Build</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {quotes.map((q) => (
                <tr key={q.id} className="transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <Link href={`/quotes/${q.id}`} className="block">
                      <div className="font-medium text-white">
                        {q.customer_company || q.customer_name || "Untitled customer"}
                      </div>
                      {q.customer_company && q.customer_name ? (
                        <div className="text-xs text-zinc-500">{q.customer_name}</div>
                      ) : null}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {TRUCK_TYPE_LABELS[q.truck_type as TruckType] ?? q.truck_type}
                  </td>
                  <td className="px-4 py-3 font-medium text-white">
                    {formatMoney(q.quote_data?.total ?? 0, q.quote_data?.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={q.status} />
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {new Date(q.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-soft/60 px-4 py-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-white">{value}</div>
    </div>
  );
}
