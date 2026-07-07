"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setQuoteStatus } from "@/app/actions";
import { formatMoney } from "@/lib/quote";
import {
  TRUCK_TYPE_LABELS,
  type QuoteStatus,
  type TruckType,
} from "@/lib/types";

// Slim, serializable projection of a quote for the sales views.
export interface SalesQuote {
  id: string;
  customer: string;
  contact: string;
  truck_type: TruckType;
  total: number;
  currency: string;
  status: QuoteStatus;
  created_at: string;
  follow_up_at: string | null;
  has_notes: boolean;
}

const STAGES: { key: QuoteStatus; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "revised", label: "Revised" },
  { key: "sent", label: "Sent" },
  { key: "accepted", label: "Accepted" },
];

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-300 ring-zinc-400/20",
  revised: "bg-blue-500/15 text-blue-300 ring-blue-400/20",
  sent: "bg-amber-500/15 text-amber-300 ring-amber-400/20",
  accepted: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/20",
  archived: "bg-zinc-700/30 text-zinc-400 ring-zinc-500/20",
};

const ALL_STATUSES: QuoteStatus[] = ["draft", "revised", "sent", "accepted", "archived"];

function isOverdue(q: SalesQuote): boolean {
  return (
    !!q.follow_up_at &&
    new Date(q.follow_up_at).getTime() < Date.now() &&
    q.status !== "accepted" &&
    q.status !== "archived"
  );
}

function FollowUpBadge({ q }: { q: SalesQuote }) {
  if (!q.follow_up_at) return null;
  const overdue = isOverdue(q);
  const d = new Date(q.follow_up_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
        overdue ? "bg-red-500/20 text-red-300" : "bg-white/10 text-zinc-400"
      }`}
    >
      ⏰ {overdue ? `overdue · ${d}` : d}
    </span>
  );
}

export function SalesWorkspace({ quotes }: { quotes: SalesQuote[] }) {
  const router = useRouter();
  const [view, setView] = useState<"board" | "list">("board");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | QuoteStatus>("all");
  const [, startTransition] = useTransition();
  const dragId = useRef<string | null>(null);
  const [dropStage, setDropStage] = useState<QuoteStatus | null>(null);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return quotes.filter(
      (q) =>
        (!s ||
          q.customer.toLowerCase().includes(s) ||
          q.contact.toLowerCase().includes(s) ||
          (TRUCK_TYPE_LABELS[q.truck_type] ?? "").toLowerCase().includes(s)) &&
        (view === "board" || statusFilter === "all" || q.status === statusFilter),
    );
  }, [quotes, search, statusFilter, view]);

  const overdue = quotes.filter(isOverdue);

  function moveTo(id: string, status: QuoteStatus) {
    startTransition(async () => {
      await setQuoteStatus(id, status);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Overdue follow-ups */}
      {overdue.length > 0 ? (
        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.07] p-3">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-red-300">
            ⏰ Follow-ups due ({overdue.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {overdue.map((q) => (
              <Link
                key={q.id}
                href={`/quotes/${q.id}`}
                className="rounded-lg border border-red-400/20 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-100 transition hover:bg-red-500/20"
              >
                {q.customer} · {formatMoney(q.total, q.currency)}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-white/12">
          {(["board", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm font-medium capitalize transition ${
                view === v ? "bg-amber-brand text-black" : "text-zinc-300 hover:bg-white/5"
              }`}
            >
              {v === "board" ? "Pipeline" : "List"}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers…"
          className="w-56 rounded-lg border border-white/12 bg-white/[0.03] px-3 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-amber-brand"
        />
        {view === "list" ? (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-1.5 text-sm capitalize text-zinc-200 outline-none focus:border-amber-brand"
          >
            <option value="all">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {view === "board" ? (
        /* ---- Pipeline board ---- */
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((stage) => {
            const cards = filtered.filter((q) => q.status === stage.key);
            const value = cards.reduce((s, q) => s + q.total, 0);
            return (
              <div
                key={stage.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropStage(stage.key);
                }}
                onDragLeave={() => setDropStage(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropStage(null);
                  if (dragId.current) moveTo(dragId.current, stage.key);
                  dragId.current = null;
                }}
                className={`flex min-h-[16rem] flex-col rounded-xl border p-3 transition ${
                  dropStage === stage.key
                    ? "border-amber-brand/60 bg-amber-brand/[0.06]"
                    : "border-white/10 bg-ink-soft/60"
                }`}
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-white">
                    {stage.label}{" "}
                    <span className="font-normal text-zinc-500">({cards.length})</span>
                  </span>
                  <span className="text-xs text-zinc-500">{formatMoney(value)}</span>
                </div>
                <div className="space-y-2">
                  {cards.map((q) => (
                    <div
                      key={q.id}
                      draggable
                      onDragStart={() => (dragId.current = q.id)}
                      className="cursor-grab rounded-lg border border-white/10 bg-white/[0.03] p-2.5 transition hover:border-amber-brand/40"
                    >
                      <Link href={`/quotes/${q.id}`} className="block">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-white">{q.customer}</span>
                          <span className="shrink-0 text-sm font-semibold text-zinc-200">
                            {formatMoney(q.total, q.currency)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {TRUCK_TYPE_LABELS[q.truck_type] ?? q.truck_type}
                        </div>
                      </Link>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <FollowUpBadge q={q} />
                        {q.has_notes ? (
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400">
                            📝 notes
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-zinc-600">
                      Drop here
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ---- List view ---- */
        <div className="overflow-hidden rounded-xl border border-white/10 bg-ink-soft/60">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Build</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Follow-up</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((q) => (
                <tr key={q.id} className="transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <Link href={`/quotes/${q.id}`} className="block">
                      <div className="font-medium text-white">{q.customer}</div>
                      {q.contact ? (
                        <div className="text-xs text-zinc-500">{q.contact}</div>
                      ) : null}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {TRUCK_TYPE_LABELS[q.truck_type] ?? q.truck_type}
                  </td>
                  <td className="px-4 py-3 font-medium text-white">
                    {formatMoney(q.total, q.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={q.status}
                      onChange={(e) => moveTo(q.id, e.target.value as QuoteStatus)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset outline-none ${
                        STATUS_STYLES[q.status] ?? STATUS_STYLES.draft
                      } bg-transparent`}
                    >
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-zinc-900 capitalize">
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <FollowUpBadge q={q} />
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {new Date(q.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    No quotes match.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
