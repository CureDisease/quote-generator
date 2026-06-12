"use client";

export function PrintButton({
  className,
  label = "Download PDF",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ??
        "w-full rounded-md bg-amber-brand px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
      }
    >
      {label}
    </button>
  );
}
