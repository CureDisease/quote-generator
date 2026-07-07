import Link from "next/link";
import { getSettings, listCatalog, listKnowledge } from "@/lib/data";
import { availableProviders } from "@/lib/ai";
import { SubmitButton } from "@/components/SubmitButton";
import { CatalogManager } from "@/components/CatalogManager";
import {
  addKnowledgeAction,
  addKnowledgeFilesAction,
  deleteKnowledgeAction,
  toggleKnowledgeAction,
  updateSettingsAction,
} from "@/app/actions";
import { DOC_TYPE_LABELS, type DocType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: {
    saved?: string;
    catalog?: string;
    note?: string;
    error?: string;
    added?: string;
    warn?: string;
  };
}) {
  const [settings, docs, catalog] = await Promise.all([
    getSettings(),
    listKnowledge(),
    listCatalog(),
  ]);
  const providers = availableProviders();
  const catalogResult =
    searchParams.error || searchParams.catalog != null
      ? {
          added: searchParams.catalog != null ? Number(searchParams.catalog) : undefined,
          note: searchParams.note,
          error: searchParams.error,
        }
      : undefined;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Knowledge &amp; Training
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          This is where you &ldquo;train&rdquo; the AI you connect via API. Upload prior quotes,
          emails, and documentation as reference material, and set the behavior instructions.
          Both are fed to the connected AI every time it drafts a quote — no fine-tuning required.
        </p>
      </div>

      {searchParams.saved ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Behavior settings saved.
        </div>
      ) : null}

      {searchParams.added != null ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Added {searchParams.added} document{searchParams.added === "1" ? "" : "s"} to the
          knowledge base.
          {searchParams.warn ? (
            <span className="mt-1 block text-xs text-amber-200/90">⚠ {searchParams.warn}</span>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* ---- AI behavior / provider ---- */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">AI provider &amp; behavior</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Choose which AI to connect and how it should behave. This steers every quote.
            </p>
          </div>

          <form
            action={updateSettingsAction}
            className="space-y-4 rounded-xl border border-white/10 bg-ink-soft/60 p-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Provider">
                <select name="provider" defaultValue={settings.provider} className="kinput">
                  {providers.map((p) => (
                    <option key={p} value={p}>
                      {p === "sample" ? "sample (built-in, no AI)" : p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Model">
                <input
                  name="model"
                  defaultValue={settings.model}
                  placeholder="claude-fable-5"
                  className="kinput"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Base URL (optional)">
                <input
                  name="base_url"
                  defaultValue={settings.base_url}
                  placeholder="leave blank for default"
                  className="kinput"
                />
              </Field>
              <Field label="Temperature">
                <input
                  name="temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  defaultValue={settings.temperature}
                  className="kinput"
                />
              </Field>
            </div>

            <Field label="Behavior instructions (system prompt)">
              <textarea
                name="system_prompt"
                rows={8}
                defaultValue={settings.system_prompt}
                placeholder="Describe how the AI should build quotes: pricing approach, markup, what to always include, tone…"
                className="kinput font-mono text-xs leading-relaxed"
              />
            </Field>

            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">
                For Claude, set provider to <code>anthropic</code>, model{" "}
                <code>claude-fable-5</code>, and add <code>ANTHROPIC_API_KEY</code> in the
                environment.
              </p>
              <SubmitButton pendingLabel="Saving…">Save behavior</SubmitButton>
            </div>
          </form>
        </section>

        {/* ---- Add knowledge ---- */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Upload training material</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Drop in prior quotes, pricing sheets, emails, and docs — the same files you
              already have. Text is extracted automatically.
            </p>
          </div>

          {/* File upload — the fast path */}
          <form
            action={addKnowledgeFilesAction}
            className="space-y-3 rounded-xl border border-white/10 bg-ink-soft/60 p-5"
          >
            <input
              type="file"
              name="documents"
              multiple
              required
              accept=".pdf,.docx,.eml,.msg,.txt,.md,.csv,image/*,application/pdf"
              className="block w-full cursor-pointer rounded-lg border border-dashed border-white/20 bg-white/[0.02] px-3 py-6 text-sm text-zinc-300 file:mr-4 file:rounded-md file:border-0 file:bg-amber-brand file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-black hover:border-amber-brand/50"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">
                PDF, Word (.docx), email (.eml/.msg), text, and images. Up to 10 files, 10MB
                each. Titles &amp; types are guessed from filenames — editable below after
                upload. PDFs/images are read by the connected AI.
              </p>
              <SubmitButton pendingLabel="Reading files…">Upload</SubmitButton>
            </div>
          </form>

          {/* Manual paste — collapsed */}
          <details className="rounded-xl border border-white/10 bg-ink-soft/60">
            <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-zinc-300 hover:text-white">
              Or paste text manually…
            </summary>
            <form action={addKnowledgeAction} className="space-y-4 p-5 pt-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title">
                <input
                  name="title"
                  placeholder="2024 taco truck build"
                  className="kinput"
                />
              </Field>
              <Field label="Type">
                <select name="doc_type" defaultValue="quote" className="kinput">
                  {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((t) => (
                    <option key={t} value={t}>
                      {DOC_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Tags (comma separated)">
              <input name="tags" placeholder="food truck, tex-mex, 20ft" className="kinput" />
            </Field>

            <Field label="Content">
              <textarea
                name="content"
                rows={8}
                required
                placeholder="Paste the quote / email / documentation here…"
                className="kinput font-mono text-xs leading-relaxed"
              />
            </Field>

            <div className="flex justify-end">
              <SubmitButton pendingLabel="Saving…">Add to knowledge base</SubmitButton>
            </div>
            </form>
          </details>
        </section>
      </div>

      {/* ---- Knowledge list ---- */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          Knowledge base{" "}
          <span className="text-sm font-normal text-zinc-500">({docs.length})</span>
        </h2>

        {docs.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-ink-soft/60 p-8 text-center text-sm text-zinc-400">
            No documents yet. Add prior quotes, emails, or docs above to teach the AI your style.
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((d) => (
              <div
                key={d.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-ink-soft/60 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-300">
                      {DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}
                    </span>
                    <span className="truncate font-medium text-white">{d.title}</span>
                    {!d.active ? (
                      <span className="text-[11px] text-zinc-500">(inactive)</span>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{d.content}</p>
                  {d.tags?.length ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {d.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded bg-amber-brand/10 px-1.5 py-0.5 text-[10px] text-amber-300"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <form action={toggleKnowledgeAction}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="active" value={(!d.active).toString()} />
                    <button
                      type="submit"
                      className="rounded-md border border-white/12 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-white/5"
                    >
                      {d.active ? "Disable" : "Enable"}
                    </button>
                  </form>
                  <form action={deleteKnowledgeAction}>
                    <input type="hidden" name="id" value={d.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-red-500/25 px-2.5 py-1.5 text-xs text-red-300 transition hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <CatalogManager items={catalog} result={catalogResult} />

      <style>{`
        .kinput {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.03);
          padding: 0.55rem 0.7rem;
          font-size: 0.875rem;
          color: #f4f4f5;
          outline: none;
        }
        .kinput::placeholder { color: #71717a; }
        .kinput:focus { border-color: #f0962a; box-shadow: 0 0 0 1px #f0962a; }
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
