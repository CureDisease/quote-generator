import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuildQuote — Custom Truck Quoting",
  description:
    "AI-assisted quoting dashboard for custom-built trucks (food trucks, coffee trucks, and more).",
};

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
    >
      {label}
    </Link>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen text-zinc-100 antialiased">
        <header className="no-print sticky top-0 z-20 border-b border-white/10 bg-[#101216]/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-brand text-lg font-black text-black">
                ◧
              </span>
              <span className="text-[15px] font-semibold tracking-tight">
                Build<span className="text-amber-brand">Quote</span>
              </span>
            </Link>
            <nav className="flex items-center gap-1">
              <NavLink href="/" label="Dashboard" />
              <NavLink href="/knowledge" label="Knowledge & Training" />
              <Link
                href="/quotes/new"
                className="ml-2 rounded-md bg-amber-brand px-3.5 py-1.5 text-sm font-semibold text-black transition hover:brightness-110"
              >
                + New Quote
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
