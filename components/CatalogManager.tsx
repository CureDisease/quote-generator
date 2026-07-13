import {
  addCatalogItemAction,
  deleteCatalogItemAction,
  extractCatalogAction,
  updateCatalogItemAction,
} from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { EQUIPMENT_CATEGORIES, type CatalogItem } from "@/lib/types";

// Equipment catalog management — the source the builder's gallery draws from.
// Items come from AI extraction over the knowledge base, or manual entry.
export function CatalogManager({
  items,
  result,
}: {
  items: CatalogItem[];
  result?: { added?: number; note?: string; error?: string };
}) {
  return (
    <section id="catalog" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            Equipment catalog{" "}
            <span className="text-sm font-normal text-zinc-500">
              ({items.length})
            </span>
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            The gallery the truck builder drags from. Extract items (with prices and
            dimensions) from your knowledge base, or add them by hand.
          </p>
        </div>
        <form action={extractCatalogAction}>
          <SubmitButton pendingLabel="Reading knowledge base…">
            Extract from knowledge base
          </SubmitButton>
        </form>
      </div>

      {result?.error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {result.error}
        </div>
      ) : result?.added != null ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Added {result.added} item{result.added === 1 ? "" : "s"} to the catalog.
          {result.note ? (
            <span className="block text-emerald-300/70">{result.note}</span>
          ) : null}
        </div>
      ) : null}

      {/* Add a new item */}
      <form
        action={addCatalogItemAction}
        className="grid items-end gap-3 rounded-xl border border-white/10 bg-ink-soft/60 p-4 sm:grid-cols-[1.6fr_1fr_repeat(5,0.7fr)_auto]"
      >
        <Mini label="Name">
          <input name="name" required placeholder="Flat-top griddle" className="cinput" />
        </Mini>
        <Mini label="Category">
          <select name="category" defaultValue="cooking" className="cinput">
            {EQUIPMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Mini>
        <Mini label="L ft">
          <input name="length_ft" type="number" step="0.1" defaultValue={3} className="cinput" />
        </Mini>
        <Mini label="D ft">
          <input name="depth_ft" type="number" step="0.1" defaultValue={2.2} className="cinput" />
        </Mini>
        <Mini label="H ft">
          <input name="height_ft" type="number" step="0.1" defaultValue={3} className="cinput" />
        </Mini>
        <Mini label="Price $">
          <input name="unit_price" type="number" step="1" defaultValue={0} className="cinput" />
        </Mini>
        <Mini label="Wt lb">
          <input name="weight_lbs" type="number" step="5" defaultValue={0} className="cinput" />
        </Mini>
        <SubmitButton pendingLabel="…">Add</SubmitButton>
      </form>

      {items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-ink-soft/60 p-8 text-center text-sm text-zinc-400">
          No catalog items yet. Extract from your knowledge base (upload pricing
          sheets / prior quotes first) or add items above.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-ink-soft/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="p-2 font-semibold">Name</th>
                <th className="p-2 font-semibold">Category</th>
                <th className="p-2 text-right font-semibold">L</th>
                <th className="p-2 text-right font-semibold">D</th>
                <th className="p-2 text-right font-semibold">H</th>
                <th className="p-2 text-right font-semibold">Price</th>
                <th className="p-2 text-right font-semibold">Watts</th>
                <th className="p-2 text-right font-semibold">Wt lb</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-white/5 align-middle">
                  <td className="p-1.5">
                    <input
                      form={`cat-${it.id}`}
                      name="name"
                      defaultValue={it.name}
                      className="cinput min-w-[10rem]"
                    />
                    {it.source === "extracted" ? (
                      <span className="ml-1 text-[10px] text-zinc-600">AI</span>
                    ) : null}
                  </td>
                  <td className="p-1.5">
                    <select
                      form={`cat-${it.id}`}
                      name="category"
                      defaultValue={it.category}
                      className="cinput"
                    >
                      {EQUIPMENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1.5">
                    <input form={`cat-${it.id}`} name="length_ft" type="number" step="0.1" defaultValue={it.length_ft} className="cinput w-16 text-right" />
                  </td>
                  <td className="p-1.5">
                    <input form={`cat-${it.id}`} name="depth_ft" type="number" step="0.1" defaultValue={it.depth_ft} className="cinput w-16 text-right" />
                  </td>
                  <td className="p-1.5">
                    <input form={`cat-${it.id}`} name="height_ft" type="number" step="0.1" defaultValue={it.height_ft} className="cinput w-16 text-right" />
                  </td>
                  <td className="p-1.5">
                    <input form={`cat-${it.id}`} name="unit_price" type="number" step="1" defaultValue={it.unit_price} className="cinput w-24 text-right" />
                  </td>
                  <td className="p-1.5">
                    <input form={`cat-${it.id}`} name="power_watts" type="number" step="10" defaultValue={it.power_watts} className="cinput w-20 text-right" />
                  </td>
                  <td className="p-1.5">
                    <input form={`cat-${it.id}`} name="weight_lbs" type="number" step="5" defaultValue={it.weight_lbs ?? 0} className="cinput w-20 text-right" />
                  </td>
                  <td className="whitespace-nowrap p-1.5 text-right">
                    <input type="hidden" form={`cat-${it.id}`} name="tags" defaultValue={it.tags.join(", ")} />
                    <form id={`cat-${it.id}`} action={updateCatalogItemAction} className="inline">
                      <input type="hidden" name="id" value={it.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-white/12 px-2 py-1 text-xs text-zinc-300 transition hover:bg-white/5"
                      >
                        Save
                      </button>
                    </form>
                    <form action={deleteCatalogItemAction} className="inline">
                      <input type="hidden" name="id" value={it.id} />
                      <button
                        type="submit"
                        className="ml-1 rounded-md border border-red-500/25 px-2 py-1 text-xs text-red-300 transition hover:bg-red-500/10"
                      >
                        ✕
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .cinput {
          width: 100%;
          border-radius: 0.4rem;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.03);
          padding: 0.4rem 0.5rem;
          font-size: 0.8rem;
          color: #f4f4f5;
          outline: none;
        }
        .cinput::placeholder { color: #71717a; }
        .cinput:focus { border-color: #f0962a; box-shadow: 0 0 0 1px #f0962a; }
      `}</style>
    </section>
  );
}

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
