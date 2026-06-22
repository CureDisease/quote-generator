import { notFound } from "next/navigation";
import { QuoteDocument } from "@/components/QuoteDocument";
import { TruckElevation } from "@/components/TruckElevation";
import { TruckPreview } from "@/components/TruckPreview";
import { getSharedQuote } from "@/lib/data";
import { isBlankSpec, normalizeBuildSpec } from "@/lib/spec";
import { TRUCK_TYPE_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

// Customer-facing, read-only view of a shared quote. Reached only via the
// unguessable share token; shows the full itemized quote + the 3D build
// preview, with none of the internal dashboard controls.
export default async function SharedQuotePage({
  params,
}: {
  params: { token: string };
}) {
  // Tokens are UUIDs — reject anything else before hitting the database.
  if (!/^[0-9a-f-]{36}$/i.test(params.token)) notFound();
  const quote = await getSharedQuote(params.token);
  if (!quote || !quote.quote_data?.lineItems?.length) notFound();

  const spec = normalizeBuildSpec(quote.build_spec, quote.truck_type);
  const showTruck = !isBlankSpec(spec);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <header className="text-center">
        <div className="inline-flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-amber-brand text-base font-black text-black">
            ◧
          </span>
          <span className="text-xl font-bold tracking-tight text-white">
            BuildQuote Customs
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          Your custom {TRUCK_TYPE_LABELS[quote.truck_type] ?? "build"} — quote &amp;
          build preview for{" "}
          <span className="text-zinc-200">
            {quote.customer_company || quote.customer_name || "you"}
          </span>
        </p>
      </header>

      {showTruck ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Your build — drag to rotate, scroll to zoom
          </h2>
          <TruckPreview
            spec={spec}
            className="h-[420px] w-full overflow-hidden rounded-xl border border-white/10 bg-[#101013]"
          />
          <div className="mt-3 rounded-xl border border-white/10 bg-white p-3">
            <TruckElevation spec={spec} />
          </div>
          {spec.summary ? (
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              {spec.summary}
            </p>
          ) : null}
        </section>
      ) : null}

      <section>
        <QuoteDocument quote={quote} />
      </section>

      <footer className="pb-6 text-center text-xs text-zinc-500">
        Questions or changes? Reply to your estimator — we&apos;ll update the quote
        and this page.
      </footer>
    </div>
  );
}
