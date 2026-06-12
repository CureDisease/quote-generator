"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TruckPreview } from "@/components/TruckPreview";
import { aiEditSpec, saveBuilderSpec } from "@/app/actions";
import { equipmentColorFor } from "@/lib/truck/model";
import {
  EQUIPMENT_CATEGORIES,
  type BuildSpec,
  type CatalogItem,
  type SpecEquipment,
} from "@/lib/types";

interface PlacedItem {
  uid: string;
  name: string;
  type: string;
  specs: string;
  lengthFt: number;
  depthFt: number;
  xFt: number; // center distance from front wall
  side: "street" | "curb";
  price: number;
}

const WALL = 0.25;
let counter = 0;
const uid = () => `i${Date.now()}_${counter++}`;

function priceFor(name: string, catalog: CatalogItem[]): number {
  const hit = catalog.find((c) => c.name.toLowerCase() === name.toLowerCase());
  return hit?.unit_price ?? 0;
}

// Lay the spec's equipment into placed items, auto-packing anything without
// an explicit position (front -> rear along each wall).
function initItems(spec: BuildSpec, catalog: CatalogItem[]): PlacedItem[] {
  const L = spec.dimensions.lengthFt;
  const consumed = { street: 1, curb: 1 };
  return spec.equipment.map((e) => {
    const lengthFt = e.lengthFt ?? 3;
    const depthFt = e.depthFt ?? 2.2;
    let side: "street" | "curb";
    let xFt: number;
    if (e.position) {
      side = e.position.side;
      xFt = e.position.xFt;
    } else {
      side = /curb|passenger|right/i.test(e.location)
        ? "curb"
        : /street|driver|left/i.test(e.location)
          ? "street"
          : consumed.street <= consumed.curb
            ? "street"
            : "curb";
      xFt = Math.min(consumed[side] + lengthFt / 2, L - 1);
      consumed[side] += lengthFt + 0.5;
    }
    return {
      uid: uid(),
      name: e.name,
      type: e.type,
      specs: e.specs,
      lengthFt,
      depthFt,
      xFt,
      side,
      price: priceFor(e.name, catalog),
    };
  });
}

function itemsToEquipment(items: PlacedItem[]): SpecEquipment[] {
  return items.map((i) => ({
    name: i.name,
    type: i.type,
    location: `${i.side}-side`,
    specs: i.specs,
    lengthFt: i.lengthFt,
    depthFt: i.depthFt,
    position: { xFt: round1(i.xFt), side: i.side },
  }));
}

const round1 = (n: number) => Math.round(n * 2) / 2; // snap to 0.5ft
const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

export function TruckBuilder({
  quoteId,
  spec: initialSpec,
  catalog,
}: {
  quoteId: string;
  spec: BuildSpec;
  catalog: CatalogItem[];
}) {
  const router = useRouter();
  const [spec, setSpec] = useState<BuildSpec>(initialSpec);
  const [items, setItems] = useState<PlacedItem[]>(() =>
    initItems(initialSpec, catalog),
  );
  const baseline = useRef(items.reduce((s, i) => s + i.price, 0));
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [instruction, setInstruction] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [aiPending, startAi] = useTransition();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<string | null>(null);

  const L = spec.dimensions.lengthFt;
  const W = spec.dimensions.widthFt;

  // Keep the live 3D preview / save payload in sync with placements.
  const liveSpec = useMemo<BuildSpec>(
    () => ({ ...spec, equipment: itemsToEquipment(items) }),
    [spec, items],
  );
  const delta = items.reduce((s, i) => s + i.price, 0) - baseline.current;

  const filteredCatalog = catalog.filter(
    (c) =>
      c.active &&
      (category === "all" || c.category === category) &&
      c.name.toLowerCase().includes(search.toLowerCase()),
  );

  // --- coordinate helpers ------------------------------------------------------
  function pointToFt(clientX: number, clientY: number) {
    const r = svgRef.current!.getBoundingClientRect();
    const xFt = ((clientX - r.left) / r.width) * L;
    const yFt = ((clientY - r.top) / r.height) * W;
    return {
      xFt: Math.min(L - 0.5, Math.max(0.5, xFt)),
      side: (yFt < W / 2 ? "street" : "curb") as "street" | "curb",
    };
  }

  function addCatalogItem(c: CatalogItem, at?: { xFt: number; side: "street" | "curb" }) {
    setItems((prev) => [
      ...prev,
      {
        uid: uid(),
        name: c.name,
        type: c.category,
        specs: c.notes,
        lengthFt: c.length_ft,
        depthFt: c.depth_ft,
        xFt: at?.xFt ?? Math.min(2, L - 1),
        side: at?.side ?? "street",
        price: c.unit_price,
      },
    ]);
    setMsg(null);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.uid !== id));
    setSelected(null);
  }

  // --- pointer drag within the plan -------------------------------------------
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const { xFt, side } = pointToFt(e.clientX, e.clientY);
    setItems((prev) =>
      prev.map((i) => (i.uid === drag.current ? { ...i, xFt, side } : i)),
    );
  }
  function endDrag() {
    if (drag.current) {
      setItems((prev) =>
        prev.map((i) => (i.uid === drag.current ? { ...i, xFt: round1(i.xFt) } : i)),
      );
    }
    drag.current = null;
  }

  // --- save / ai ---------------------------------------------------------------
  function save(reprice: boolean) {
    setMsg(null);
    startTransition(async () => {
      const res = await saveBuilderSpec(quoteId, JSON.stringify(liveSpec), reprice);
      if (res.ok) {
        setMsg({ kind: "ok", text: reprice ? "Saved & re-priced." : "Layout saved." });
        baseline.current = items.reduce((s, i) => s + i.price, 0);
        router.refresh();
        if (reprice) router.push(`/quotes/${quoteId}`);
      } else {
        setMsg({ kind: "err", text: res.error ?? "Save failed." });
      }
    });
  }

  function runAi() {
    if (!instruction.trim()) return;
    setMsg(null);
    startAi(async () => {
      const res = await aiEditSpec(quoteId, JSON.stringify(liveSpec), instruction);
      if (res.ok && res.spec) {
        setSpec(res.spec);
        setItems(initItems(res.spec, catalog));
        setInstruction("");
        setMsg({ kind: "ok", text: res.note ?? "Applied." });
      } else {
        setMsg({ kind: "err", text: res.error ?? "AI edit failed." });
      }
    });
  }

  // plan pixel height: keep proportional, capped
  const planAspect = W / L;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        {msg ? (
          <div
            className={`rounded-lg px-4 py-2.5 text-sm ${
              msg.kind === "ok"
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border border-red-500/30 bg-red-500/10 text-red-200"
            }`}
          >
            {msg.text}
          </div>
        ) : null}

        {/* Floor plan editor */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Floor plan — drag to move, drop gallery items in
            </h2>
            <span className="text-xs text-zinc-500">
              {L}ft × {W}ft · front ◀
            </span>
          </div>
          <div
            className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-[#0d1117]"
            style={{ aspectRatio: `${L} / ${W}` }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/catalog");
              const c = catalog.find((x) => x.id === id);
              if (c) addCatalogItem(c, pointToFt(e.clientX, e.clientY));
            }}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${L} ${W}`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full touch-none"
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
            >
              {/* shell */}
              <rect x={0} y={0} width={L} height={W} fill="#11161d" stroke="#3f3f46" strokeWidth={0.12} />
              <line x1={0} y1={W / 2} x2={L} y2={W / 2} stroke="#27272a" strokeWidth={0.05} strokeDasharray="0.4 0.4" />
              {/* side labels */}
              <text x={0.3} y={0.7} fontSize={0.5} fill="#52525b">street</text>
              <text x={0.3} y={W - 0.4} fontSize={0.5} fill="#52525b">curb</text>
              {/* serving windows */}
              {spec.exterior.servingWindows.map((w, i) => {
                const ww = Math.min(w.widthIn / 12, L - 1);
                const y = w.side === "curb" ? W - 0.18 : w.side === "street" ? 0.04 : W / 2;
                return (
                  <rect key={`win${i}`} x={L / 2 - ww / 2} y={y} width={ww} height={0.14} fill="#f0962a" />
                );
              })}
              {/* equipment */}
              {items.map((it) => {
                const w = Math.min(it.lengthFt, L);
                const d = Math.min(it.depthFt, W / 2 - WALL);
                const x = Math.min(Math.max(it.xFt - w / 2, 0), L - w);
                const y = it.side === "street" ? WALL : W - WALL - d;
                const isSel = selected === it.uid;
                return (
                  <g
                    key={it.uid}
                    style={{ cursor: "grab" }}
                    onPointerDown={(e) => {
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                      drag.current = it.uid;
                      setSelected(it.uid);
                    }}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={d}
                      rx={0.15}
                      fill={equipmentColorFor(it.type)}
                      fillOpacity={isSel ? 0.95 : 0.8}
                      stroke={isSel ? "#fafafa" : "#09090b"}
                      strokeWidth={isSel ? 0.12 : 0.05}
                    />
                    <text
                      x={x + w / 2}
                      y={y + d / 2 + 0.18}
                      fontSize={Math.min(0.5, w / Math.max(6, it.name.length) * 1.6)}
                      fill="#fafafa"
                      textAnchor="middle"
                    >
                      {it.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          {selected ? (
            <div className="mt-2 flex items-center justify-between rounded-lg border border-white/10 bg-ink-soft/60 px-3 py-2 text-xs">
              <span className="text-zinc-300">
                {items.find((i) => i.uid === selected)?.name}
              </span>
              <button
                onClick={() => removeItem(selected)}
                className="rounded border border-red-500/30 px-2 py-1 text-red-300 transition hover:bg-red-500/10"
              >
                Remove from build
              </button>
            </div>
          ) : null}
        </div>

        {/* 3D preview */}
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            3D preview
          </h2>
          <TruckPreview spec={liveSpec} className="h-80 w-full overflow-hidden rounded-xl border border-white/10 bg-[#101013]" />
        </div>

        {/* AI edit */}
        <div className="rounded-xl border border-white/10 bg-ink-soft/60 p-4">
          <h2 className="mb-2 text-sm font-semibold text-white">Tell the AI what to change</h2>
          <div className="flex gap-2">
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAi()}
              placeholder="e.g. swap the range for a flat-top and move the fridge curb-side"
              className="flex-1 rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-amber-brand"
            />
            <button
              onClick={runAi}
              disabled={aiPending}
              className="rounded-md bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
            >
              {aiPending ? "Thinking…" : "Apply"}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar: price, gallery, save */}
      <aside className="space-y-5">
        <div className="rounded-xl border border-white/10 bg-ink-soft/60 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-white">Equipment delta</span>
            <span
              className={`text-lg font-bold ${
                delta > 0 ? "text-red-300" : delta < 0 ? "text-emerald-300" : "text-zinc-400"
              }`}
            >
              {delta > 0 ? "+" : ""}
              {money(delta)}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            vs. the priced quote, using catalog prices. Re-price to lock it into the quote.
          </p>
          <div className="mt-3 space-y-2">
            <button
              onClick={() => save(true)}
              disabled={pending}
              className="w-full rounded-md bg-amber-brand px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-60"
            >
              {pending ? "Working…" : "Save & re-price quote"}
            </button>
            <button
              onClick={() => save(false)}
              disabled={pending}
              className="w-full rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/15 disabled:opacity-60"
            >
              Save layout only
            </button>
          </div>
        </div>

        {/* Gallery */}
        <div className="rounded-xl border border-white/10 bg-ink-soft/60 p-4">
          <h2 className="mb-2 text-sm font-semibold text-white">Equipment gallery</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="mb-2 w-full rounded-md border border-white/12 bg-white/[0.03] px-2.5 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-amber-brand"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mb-3 w-full rounded-md border border-white/12 bg-white/[0.03] px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-brand"
          >
            <option value="all">All categories</option>
            {EQUIPMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {catalog.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Catalog is empty. Add items on the Knowledge &amp; Training page.
            </p>
          ) : (
            <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
              {filteredCatalog.map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/catalog", c.id)}
                  onClick={() => addCatalogItem(c)}
                  title="Drag onto the floor plan, or click to add"
                  className="flex cursor-grab items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-xs transition hover:border-amber-brand/40 hover:bg-white/[0.05]"
                >
                  <span className="min-w-0">
                    <span
                      className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                      style={{ backgroundColor: equipmentColorFor(c.category) }}
                    />
                    <span className="text-zinc-200">{c.name}</span>
                  </span>
                  <span className="shrink-0 text-zinc-500">{money(c.unit_price)}</span>
                </div>
              ))}
              {filteredCatalog.length === 0 ? (
                <p className="text-xs text-zinc-500">No matches.</p>
              ) : null}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
