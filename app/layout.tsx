import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuildQuote — Custom Truck Quoting",
  description:
    "AI-assisted quoting dashboard for custom-built trucks (food trucks, coffee trucks, and more).",
};

// Minimal root layout — shared by the internal dashboard (which adds its nav
// in app/(dashboard)/layout.tsx) and the public customer share page (/q/*).
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
