import Link from "next/link";
import { listQuotes, getSettings } from "@/lib/data";
import { formatMoney } from "@/lib/quote";
import { SalesWorkspace, type SalesQuote } from "@/components/SalesWorkspace";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [quotes, settings] = await Promise.all([listQuotes(), getSettings()]);
  const connected = settings.provider !== "sample";

  const slim: SalesQuote[] = quotes.map((q) => ({
    id: q.id,
    customer: q.customer_company || q.customer_name || "Untitled customer",
    contact: q.customer_name && q.customer_company ? q.customer_name : q.customer_contact,
    truck_type: q.truck_type,
    total: q.quote_data?.total ?? 0,
    currency: q.quote_data?.currency ?? "USD",
    status: q.status,
    created_at: q.created_at,
    follow_up_at: q.follow_up_at ?? null,
    has_notes: Boolean(q.sales_notes?.trim()),
  }));

  const open = slim.filter((q) => q.status !== "accepted" && q.status !== "archived");
  const pipelineValue = open.reduce((s, q) => s + q.total, 0);
  const wonValue = slim
    .filter((q) => q.status === "accepted")
    .reduce((s, q) => s + q.total, 0);
  const sentCount = slim.filter((q) => q.status === "sent").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales Pipeline</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Every build from first email to signed quote — drag deals between stages.
          </p>
        </div>
        <Link
          href="/quotes/new"
          className="rounded-md bg-amber-brand px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
        >
          + New Quote
        </Link>
      </div>

      {!connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <span>
            <strong>Framework mode.</strong> Running the built-in sample estimator — connect
            your AI provider and upload training material to generate from your own data.
          </span>
          <Link href="/knowledge" className="font-semibold underline underline-offset-2">
            Knowledge &amp; Training →
          </Link>
        </div>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Open quotes" value={String(open.length)} />
        <Stat label="Pipeline value" value={formatMoney(pipelineValue)} />
        <Stat label="Awaiting customer" value={String(sentCount)} />
        <Stat label="Won" value={formatMoney(wonValue)} accent />
      </div>

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
        <SalesWorkspace quotes={slim} />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-soft/60 px-4 py-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div
        className={`mt-1 text-2xl font-semibold tracking-tight ${
          accent ? "text-emerald-300" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
