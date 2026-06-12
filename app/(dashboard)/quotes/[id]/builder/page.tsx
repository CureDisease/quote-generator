import Link from "next/link";
import { notFound } from "next/navigation";
import { TruckBuilder } from "@/components/TruckBuilder";
import { getQuote, listCatalog } from "@/lib/data";
import { normalizeBuildSpec } from "@/lib/spec";

export const dynamic = "force-dynamic";

export default async function BuilderPage({
  params,
}: {
  params: { id: string };
}) {
  const quote = await getQuote(params.id);
  if (!quote) notFound();
  const catalog = await listCatalog({ activeOnly: true });
  const spec = normalizeBuildSpec(quote.build_spec, quote.truck_type);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/quotes/${quote.id}`}
          className="text-sm text-zinc-400 hover:text-white"
        >
          ← Back to quote
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Truck Builder — {quote.customer_company || quote.customer_name || "Customer"}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Drag equipment around the floor plan, pull new items from the gallery, or
          tell the AI what to change. Re-price when you&apos;re happy to push it into
          the quote.
        </p>
      </div>

      <TruckBuilder quoteId={quote.id} spec={spec} catalog={catalog} />
    </div>
  );
}
