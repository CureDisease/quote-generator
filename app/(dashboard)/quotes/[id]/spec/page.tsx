import Link from "next/link";
import { notFound } from "next/navigation";
import { generateQuoteAction, setQuoteVehicleAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { TruckPreview } from "@/components/TruckPreview";
import {
  getQuote,
  getVehicleModel,
  listBuildDocuments,
  listVehicleModels,
} from "@/lib/data";
import {
  equipmentToLines,
  isBlankSpec,
  normalizeBuildSpec,
  windowsToLines,
} from "@/lib/spec";
import { TRUCK_TYPE_LABELS, type TruckType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SpecReviewPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const quote = await getQuote(params.id);
  if (!quote) notFound();
  const [docs, vehicles, vehicle] = await Promise.all([
    listBuildDocuments(params.id),
    listVehicleModels({ activeOnly: true }),
    quote.vehicle_model_id ? getVehicleModel(quote.vehicle_model_id) : Promise.resolve(null),
  ]);
  const spec = normalizeBuildSpec(quote.build_spec, quote.truck_type);
  const hasQuote = (quote.quote_data?.lineItems?.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={hasQuote ? `/quotes/${quote.id}` : "/"}
          className="text-sm text-zinc-400 hover:text-white"
        >
          ← {hasQuote ? "Back to quote" : "Dashboard"}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Build Spec — {quote.customer_company || quote.customer_name || "Customer"}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          This is what the AI understood from the customer&apos;s documents. Correct
          anything that&apos;s wrong, then generate the quote — both the quote and the
          3D preview below are driven by this spec.
        </p>
      </div>

      {searchParams.error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {searchParams.error}
        </div>
      ) : null}

      {/* Base vehicle selector */}
      <form
        action={setQuoteVehicleAction}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-ink-soft/60 p-4"
      >
        <input type="hidden" name="quoteId" value={quote.id} />
        <label className="block flex-1">
          <span className="mb-1.5 block text-xs font-medium text-zinc-400">
            Base vehicle (drives the 3D model &amp; build sheet)
          </span>
          <select
            name="vehicleModelId"
            defaultValue={quote.vehicle_model_id ?? ""}
            className="input"
          >
            <option value="">Generic box (no specific vehicle)</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <SubmitButton pendingLabel="Applying…">Set vehicle</SubmitButton>
        {vehicles.length === 0 ? (
          <p className="w-full text-xs text-zinc-500">
            No vehicles defined yet — add them on{" "}
            <Link href="/vehicles" className="underline">
              Vehicles &amp; Workshop
            </Link>
            .
          </p>
        ) : null}
      </form>

      {!isBlankSpec(spec) ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Build preview — drag to rotate, scroll to zoom
          </h3>
          <TruckPreview spec={spec} vehicle={vehicle} />
          <p className="mt-1.5 text-xs text-zinc-500">
            The preview updates after you save the spec.
          </p>
        </div>
      ) : null}

      {docs.length > 0 ? (
        <div className="rounded-xl border border-white/10 bg-ink-soft/60 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">Source documents</h3>
          <ul className="space-y-1 text-xs text-zinc-400">
            {docs.map((d) => (
              <li key={d.id}>
                📎 {d.filename}
                <span className="text-zinc-600">
                  {" "}
                  · {(d.size_bytes / 1024).toFixed(0)}KB
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {spec.openQuestions.length > 0 ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
          <h3 className="mb-2 text-sm font-semibold text-amber-200">
            Open questions to confirm with the customer
          </h3>
          <ul className="list-inside list-disc space-y-1 text-xs text-amber-100/80">
            {spec.openQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form action={generateQuoteAction} className="space-y-6">
        <input type="hidden" name="quoteId" value={quote.id} />

        <Section title="Overview">
          <Field label="Summary" full>
            <textarea name="summary" rows={3} defaultValue={spec.summary} className="input" />
          </Field>
          <Field label="Build type">
            <select name="truckType" defaultValue={spec.truckType} className="input">
              {(Object.keys(TRUCK_TYPE_LABELS) as TruckType[]).map((t) => (
                <option key={t} value={t}>
                  {TRUCK_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Base vehicle">
            <input name="baseVehicle" defaultValue={spec.baseVehicle} className="input" />
          </Field>
        </Section>

        <Section title="Dimensions (feet)">
          <Field label="Length">
            <input type="number" step="0.5" name="lengthFt" defaultValue={spec.dimensions.lengthFt} className="input" />
          </Field>
          <Field label="Width">
            <input type="number" step="0.5" name="widthFt" defaultValue={spec.dimensions.widthFt} className="input" />
          </Field>
          <Field label="Height">
            <input type="number" step="0.5" name="heightFt" defaultValue={spec.dimensions.heightFt} className="input" />
          </Field>
        </Section>

        <Section title="Equipment">
          <Field label="One item per line: Name | type | location | specs" full>
            <textarea
              name="equipment"
              rows={Math.max(5, spec.equipment.length + 1)}
              defaultValue={equipmentToLines(spec.equipment)}
              placeholder={"Flat-top griddle | cooking | street-side galley | 36in\nReach-in refrigerator | refrigeration | rear |"}
              className="input font-mono text-xs"
            />
          </Field>
        </Section>

        <Section title="Power">
          <Field label="Generator (kW, 0 = none)">
            <input type="number" step="0.5" name="generatorKw" defaultValue={spec.power.generatorKw} className="input" />
          </Field>
          <div className="flex items-end gap-4 pb-2">
            <Check name="shorePower" label="Shore power" checked={spec.power.shorePower} />
            <Check name="batteries" label="Batteries" checked={spec.power.batteries} />
            <Check name="solar" label="Solar" checked={spec.power.solar} />
          </div>
          <Field label="Notes" full>
            <input name="powerNotes" defaultValue={spec.power.notes} className="input" />
          </Field>
        </Section>

        <Section title="Plumbing">
          <Field label="Fresh tank (gal)">
            <input type="number" name="freshTankGal" defaultValue={spec.plumbing.freshTankGal} className="input" />
          </Field>
          <Field label="Grey tank (gal)">
            <input type="number" name="greyTankGal" defaultValue={spec.plumbing.greyTankGal} className="input" />
          </Field>
          <Field label="Sinks">
            <input type="number" name="sinks" defaultValue={spec.plumbing.sinks} className="input" />
          </Field>
          <div className="flex items-end gap-4 pb-2">
            <Check name="waterHeater" label="Water heater" checked={spec.plumbing.waterHeater} />
          </div>
          <Field label="Notes" full>
            <input name="plumbingNotes" defaultValue={spec.plumbing.notes} className="input" />
          </Field>
        </Section>

        <Section title="Exterior">
          <Field label="Paint color">
            <input name="paintColor" defaultValue={spec.exterior.paintColor} className="input" />
          </Field>
          <Field label="Wrap / graphics">
            <input name="wrap" defaultValue={spec.exterior.wrap} className="input" />
          </Field>
          <Field label="Serving windows — one per line: side widthIn (sides: street, curb, rear, front)" full>
            <textarea
              name="servingWindows"
              rows={2}
              defaultValue={windowsToLines(spec.exterior.servingWindows)}
              placeholder="curb 48"
              className="input font-mono text-xs"
            />
          </Field>
        </Section>

        <Section title="Interior">
          <Field label="Flooring">
            <input name="flooring" defaultValue={spec.interior.flooring} className="input" />
          </Field>
          <Field label="Finishes">
            <input name="finishes" defaultValue={spec.interior.finishes} className="input" />
          </Field>
        </Section>

        <Section title="Customer must-haves & open questions">
          <Field label="Must-haves (one per line)" full>
            <textarea
              name="mustHaves"
              rows={3}
              defaultValue={spec.mustHaves.join("\n")}
              className="input"
            />
          </Field>
          <Field label="Open questions (one per line)" full>
            <textarea
              name="openQuestions"
              rows={3}
              defaultValue={spec.openQuestions.join("\n")}
              className="input"
            />
          </Field>
        </Section>

        <div className="flex items-center justify-end gap-3">
          <SubmitButton pendingLabel={hasQuote ? "Regenerating quote…" : "Generating quote…"}>
            {hasQuote ? "Save spec & regenerate quote" : "Save spec & generate quote →"}
          </SubmitButton>
        </div>
      </form>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.03);
          padding: 0.55rem 0.7rem;
          font-size: 0.875rem;
          color: #f4f4f5;
          outline: none;
        }
        .input::placeholder { color: #71717a; }
        .input:focus { border-color: #f0962a; box-shadow: 0 0 0 1px #f0962a; }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-white/10 bg-ink-soft/60 p-4">
      <legend className="px-1.5 text-sm font-semibold text-white">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-xs font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function Check({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-300">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="h-4 w-4 rounded border-white/20 bg-white/5 accent-[#f0962a]"
      />
      {label}
    </label>
  );
}
