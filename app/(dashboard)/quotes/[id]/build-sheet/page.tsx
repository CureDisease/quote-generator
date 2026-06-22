import Link from "next/link";
import { notFound } from "next/navigation";
import { TruckElevation } from "@/components/TruckElevation";
import { getQuote, getVehicleModel } from "@/lib/data";
import { normalizeBuildSpec } from "@/lib/spec";
import {
  buildTruckScene,
  ftIn,
  planFromScene,
  type PlanItem,
} from "@/lib/truck/model";
import { TRUCK_TYPE_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAD = 3; // plan margin in feet
const SCALE = 26; // px per foot for the plan SVG

export default async function BuildSheetPage({
  params,
}: {
  params: { id: string };
}) {
  const quote = await getQuote(params.id);
  if (!quote) notFound();
  const vehicle = quote.vehicle_model_id
    ? await getVehicleModel(quote.vehicle_model_id)
    : null;
  const spec = normalizeBuildSpec(quote.build_spec, quote.truck_type);
  const scene = buildTruckScene(spec, vehicle);
  const plan = planFromScene(scene).sort((a, b) => a.xFromFrontFt - b.xFromFrontFt);
  const L = scene.lengthFt;
  const W = scene.widthFt;
  const rev = String.fromCharCode(65 + (quote.revisions?.length ?? 0)); // A, B, ...
  const date = new Date(quote.updated_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={`/quotes/${quote.id}`} className="text-sm text-zinc-400 hover:text-white">
          ← Back to quote
        </Link>
        <PrintHint />
      </div>

      <div className="print-sheet mx-auto rounded-xl bg-white p-8 text-zinc-900 shadow-2xl shadow-black/40 sm:p-10">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded bg-amber-500 text-sm font-black text-black">
                ◧
              </span>
              <span className="text-lg font-bold tracking-tight">BuildQuote Customs</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">Shop Build Sheet — install reference</p>
          </div>
          <div className="text-right text-xs text-zinc-600">
            <div className="text-base font-bold uppercase tracking-wide text-zinc-800">
              Build Sheet
            </div>
            <div>#{quote.id.slice(0, 8).toUpperCase()}</div>
            <div>Rev {rev} · {date}</div>
          </div>
        </div>

        {/* Build summary */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Fact label="Customer" value={quote.customer_company || quote.customer_name || "—"} />
          <Fact label="Base vehicle" value={vehicle?.label || spec.baseVehicle || TRUCK_TYPE_LABELS[quote.truck_type]} />
          <Fact label="Body" value={`${ftIn(L)} L × ${ftIn(W)} W × ${ftIn(scene.heightFt)} H`} />
          <Fact label="Items" value={`${plan.length} placed`} />
        </div>

        {/* Floor plan */}
        <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-zinc-700">
          Floor plan (top view · front ▶)
        </h2>
        <p className="mb-2 text-xs text-zinc-500">
          Each item is dimensioned from the front wall to its center. Street side top,
          curb side bottom.
        </p>
        <FloorPlan plan={plan} L={L} W={W} scene={scene} />

        {/* Side elevations */}
        <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-zinc-700">
          Side elevations
        </h2>
        <div className="mt-2 space-y-3">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Street side
            </div>
            <TruckElevation spec={spec} vehicle={vehicle} side="street" className="w-full" />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Curb side (serving)
            </div>
            <TruckElevation spec={spec} vehicle={vehicle} side="curb" className="w-full" />
          </div>
        </div>

        {/* Equipment schedule */}
        <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-zinc-700">
          Equipment schedule
        </h2>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-300 text-left text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="py-1.5 font-semibold">#</th>
              <th className="py-1.5 font-semibold">Item</th>
              <th className="py-1.5 font-semibold">Side</th>
              <th className="py-1.5 text-right font-semibold">From front (center)</th>
              <th className="py-1.5 text-right font-semibold">Footprint</th>
            </tr>
          </thead>
          <tbody>
            {plan.map((p, i) => (
              <tr key={i} className="border-b border-zinc-100">
                <td className="py-1.5 text-zinc-500">{i + 1}</td>
                <td className="py-1.5 font-medium text-zinc-800">{p.name}</td>
                <td className="py-1.5 capitalize text-zinc-600">{p.side}</td>
                <td className="py-1.5 text-right text-zinc-700">{ftIn(p.xFromFrontFt)}</td>
                <td className="py-1.5 text-right text-zinc-600">
                  {ftIn(p.lengthFt)} × {ftIn(p.depthFt)}
                </td>
              </tr>
            ))}
            {plan.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-3 text-center text-zinc-400">
                  No equipment placed yet — lay it out in the builder.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        {/* Cut openings */}
        <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-zinc-700">
          Cut openings &amp; modifications
        </h2>
        <ul className="mt-2 space-y-1 text-sm text-zinc-700">
          {spec.exterior.servingWindows.map((w, i) => (
            <li key={i} className="flex justify-between border-b border-zinc-100 py-1">
              <span>Serving window — {w.side} side</span>
              <span className="text-zinc-600">rough opening ≈ {w.widthIn}" wide</span>
            </li>
          ))}
          {spec.power.generatorKw > 0 ? (
            <li className="flex justify-between border-b border-zinc-100 py-1">
              <span>Generator compartment / power</span>
              <span className="text-zinc-600">{spec.power.generatorKw}kW</span>
            </li>
          ) : null}
          {spec.exterior.servingWindows.length === 0 && spec.power.generatorKw === 0 ? (
            <li className="py-1 text-zinc-400">None specified.</li>
          ) : null}
        </ul>

        {/* Hookups */}
        <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Power</h3>
            <p className="mt-1 text-zinc-700">
              {[
                spec.power.generatorKw ? `${spec.power.generatorKw}kW generator` : "",
                spec.power.shorePower ? "shore power inlet" : "",
                spec.power.batteries ? "battery bank" : "",
                spec.power.solar ? "solar" : "",
                spec.power.notes,
              ].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Plumbing</h3>
            <p className="mt-1 text-zinc-700">
              {[
                spec.plumbing.freshTankGal ? `${spec.plumbing.freshTankGal}gal fresh` : "",
                spec.plumbing.greyTankGal ? `${spec.plumbing.greyTankGal}gal grey` : "",
                spec.plumbing.sinks ? `${spec.plumbing.sinks} sink(s)` : "",
                spec.plumbing.waterHeater ? "water heater" : "",
                spec.plumbing.notes,
              ].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        </div>

        {/* Branding */}
        {spec.exterior.decals.length > 0 || spec.exterior.paintColor || spec.exterior.wrap ? (
          <>
            <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-zinc-700">
              Wrap &amp; branding
            </h2>
            <p className="mt-1 text-sm text-zinc-700">
              {[spec.exterior.paintColor && `Body: ${spec.exterior.paintColor}`, spec.exterior.wrap]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
            {spec.exterior.decals.length > 0 ? (
              <ul className="mt-1 space-y-1 text-sm text-zinc-700">
                {spec.exterior.decals.map((d) => (
                  <li key={d.id} className="flex justify-between border-b border-zinc-100 py-1">
                    <span>{d.label || "Graphic"} — {d.side} side</span>
                    <span className="text-zinc-600">
                      {ftIn(d.xFt)} from front · {ftIn(d.widthFt)} wide
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}

        <p className="mt-8 border-t border-zinc-200 pt-3 text-center text-[11px] text-zinc-400">
          Generated from the approved build spec · Rev {rev} · verify against the customer
          quote before fabrication.
        </p>
      </div>
    </div>
  );
}

function FloorPlan({
  plan,
  L,
  W,
  scene,
}: {
  plan: PlanItem[];
  L: number;
  W: number;
  scene: ReturnType<typeof buildTruckScene>;
}) {
  const w = (L + PAD * 2) * SCALE;
  const h = (W + PAD * 2) * SCALE;
  const ox = PAD * SCALE;
  const oy = PAD * SCALE;
  const fx = (ft: number) => ox + ft * SCALE; // front wall at x=0 (left)
  const fy = (ft: number) => oy + ft * SCALE;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-2 w-full rounded-lg border border-zinc-300 bg-white"
      style={{ maxHeight: 420 }}
    >
      {/* body outline */}
      <rect x={ox} y={oy} width={L * SCALE} height={W * SCALE} fill="#f8fafc" stroke="#111827" strokeWidth={2} />
      {/* centerline */}
      <line x1={ox} y1={fy(W / 2)} x2={fx(L)} y2={fy(W / 2)} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 4" />
      {/* front marker */}
      <text x={ox - 6} y={fy(W / 2)} fontSize={11} fill="#6b7280" textAnchor="end" dominantBaseline="middle">FRONT ▶</text>
      <text x={ox + 4} y={oy + 12} fontSize={10} fill="#94a3b8">street</text>
      <text x={ox + 4} y={oy + W * SCALE - 5} fontSize={10} fill="#94a3b8">curb</text>

      {/* serving windows on the long walls */}
      {scene.lengthFt && plan ? null : null}

      {/* equipment */}
      {plan.map((p, i) => {
        const bw = p.lengthFt * SCALE;
        const bd = p.depthFt * SCALE;
        const cx = fx(p.xFromFrontFt);
        const x = cx - bw / 2;
        const y = p.side === "street" ? oy + 2 : oy + W * SCALE - bd - 2;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={bd} rx={3} fill="#e0e7ff" stroke="#1e3a5f" strokeWidth={1.5} />
            <text x={cx} y={y + bd / 2} fontSize={10} fill="#1e293b" textAnchor="middle" dominantBaseline="middle">
              {i + 1}
            </text>
            {/* dimension from front to center */}
            <line x1={ox} y1={y + bd + 8} x2={cx} y2={y + bd + 8} stroke="#94a3b8" strokeWidth={0.75} />
            <text x={(ox + cx) / 2} y={y + bd + 6} fontSize={9} fill="#64748b" textAnchor="middle">
              {ftIn(p.xFromFrontFt)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-0.5 font-medium text-zinc-800">{value}</div>
    </div>
  );
}

function PrintHint() {
  return (
    <span className="rounded-md bg-white/10 px-3 py-1.5 text-xs text-zinc-300">
      Use your browser&apos;s Print (⌘/Ctrl-P) to save as PDF
    </span>
  );
}
