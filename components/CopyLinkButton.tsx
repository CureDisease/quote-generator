"use client";

import { useState } from "react";

export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API unavailable (http / permissions) — fall back to prompt.
      window.prompt("Copy this link:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="w-full rounded-md bg-amber-brand px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
    >
      {copied ? "Copied!" : "Copy customer link"}
    </button>
  );
}
