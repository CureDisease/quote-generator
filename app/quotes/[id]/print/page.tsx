import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuote } from "@/lib/data";
import { QuoteDocument } from "@/components/QuoteDocument";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function QuotePrintPage({
  params,
}: {
  params: { id: string };
}) {
  const quote = await getQuote(params.id);
  if (!quote) notFound();

  return (
    <div className="space-y-5">
      <div className="no-print flex items-center justify-between">
        <Link href={`/quotes/${quote.id}`} className="text-sm text-zinc-400 hover:text-white">
          ← Back to quote
        </Link>
        <PrintButton
          className="rounded-md bg-amber-brand px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
          label="Print / Save as PDF"
        />
      </div>
      <p className="no-print text-center text-xs text-zinc-500">
        Tip: in the print dialog choose “Save as PDF” as the destination.
      </p>
      <QuoteDocument quote={quote} />
    </div>
  );
}
