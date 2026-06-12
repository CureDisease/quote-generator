import Link from "next/link";
import { intakeQuoteAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { getSettings } from "@/lib/data";
import { TRUCK_TYPE_LABELS, type TruckType } from "@/lib/types";

export const dynamic = "force-dynamic";

const ACCEPT =
  ".pdf,.docx,.eml,.msg,.txt,.md,.csv,.png,.jpg,.jpeg,.gif,.webp,application/pdf,image/*";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const settings = await getSettings();
  const connected = settings.provider !== "sample";
  const error = searchParams.error;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New Quote</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Upload the customer&apos;s emails and documents, or describe what they want.
          The {connected ? `connected AI (${settings.provider})` : "built-in sample estimator"}{" "}
          will read everything and produce a structured build spec you can review before
          the quote is generated.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <form action={intakeQuoteAction} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer name">
            <input
              name="customerName"
              placeholder="Jane Doe"
              className="input"
            />
          </Field>
          <Field label="Company">
            <input
              name="customerCompany"
              placeholder="Doe's Tacos LLC"
              className="input"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact (email / phone)">
            <input
              name="customerContact"
              placeholder="jane@doestacos.com"
              className="input"
            />
          </Field>
          <Field label="Build type">
            <select name="truckType" defaultValue="food_truck" className="input">
              {(Object.keys(TRUCK_TYPE_LABELS) as TruckType[]).map((t) => (
                <option key={t} value={t}>
                  {TRUCK_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Customer emails & documents (optional)">
          <input
            type="file"
            name="documents"
            multiple
            accept={ACCEPT}
            className="block w-full cursor-pointer rounded-lg border border-dashed border-white/20 bg-white/[0.02] px-3 py-4 text-sm text-zinc-300 file:mr-4 file:rounded-md file:border-0 file:bg-amber-brand file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-black hover:border-amber-brand/50"
          />
          <p className="mt-1.5 text-xs text-zinc-500">
            PDFs, Word docs (.docx), emails (.eml/.msg), images of sketches or
            reference trucks, and plain text. Up to 10 files, 10MB each.
          </p>
        </Field>

        <Field label="What does the customer want? (optional if documents cover it)">
          <textarea
            name="requirements"
            rows={5}
            placeholder="e.g. A 20ft food truck for Tex-Mex. Needs a flat-top griddle, double fryer, 6-burner range, reach-in fridge + freezer, a service window on the passenger side, onboard generator, and a bold red & gold wrap. Budget around $95k."
            className="input"
          />
        </Field>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-zinc-500">
            Knowledge base &amp; AI behavior are configured on{" "}
            <Link href="/knowledge" className="underline underline-offset-2">
              Knowledge &amp; Training
            </Link>
            .
          </p>
          <SubmitButton pendingLabel="Reading documents…">
            Extract build spec →
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-300">{label}</span>
      {children}
    </label>
  );
}
