import Link from "next/link";
import {
  addModAction,
  addVehicleAction,
  deleteModAction,
  deleteVehicleAction,
  updateModAction,
  updateVehicleAction,
} from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { listVehicleModels, listWorkshopMods } from "@/lib/data";
import { MOD_CATEGORIES, type VehicleModel, type WorkshopMod } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  const [vehicles, mods] = await Promise.all([
    listVehicleModels(),
    listWorkshopMods(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Vehicles &amp; Workshop
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Define the base vehicles you build on (real dimensions, cab, axles) and
          the modifications your shop can perform. Quotes reference a base vehicle so
          the 3D model and build sheet match the actual chassis.
        </p>
      </div>

      {/* ---- Vehicle models ---- */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          Base vehicles{" "}
          <span className="text-sm font-normal text-zinc-500">({vehicles.length})</span>
        </h2>

        <form
          action={addVehicleAction}
          className="grid items-end gap-3 rounded-xl border border-white/10 bg-ink-soft/60 p-4 sm:grid-cols-[1.8fr_repeat(5,0.8fr)_auto]"
        >
          <Mini label="Label">
            <input name="label" required placeholder="Chevy P30 Step Van 22ft" className="vinput" />
          </Mini>
          <Mini label="Len ft">
            <input name="length_ft" type="number" step="0.5" defaultValue={22} className="vinput" />
          </Mini>
          <Mini label="Wid ft">
            <input name="width_ft" type="number" step="0.1" defaultValue={8} className="vinput" />
          </Mini>
          <Mini label="Hgt ft">
            <input name="height_ft" type="number" step="0.1" defaultValue={9.5} className="vinput" />
          </Mini>
          <Mini label="Cab ft">
            <input name="cab_length_ft" type="number" step="0.5" defaultValue={4} className="vinput" />
          </Mini>
          <Mini label="Trailer?">
            <input name="is_trailer" type="checkbox" className="h-5 w-5 accent-[#f0962a]" />
          </Mini>
          <SubmitButton pendingLabel="…">Add</SubmitButton>
        </form>

        {vehicles.length === 0 ? (
          <Empty>No vehicles yet. Add the chassis and trailers your shop builds on.</Empty>
        ) : (
          <div className="space-y-2">
            {vehicles.map((v) => (
              <VehicleRow key={v.id} v={v} />
            ))}
          </div>
        )}
      </section>

      {/* ---- Workshop mods ---- */}
      <section id="mods" className="space-y-4">
        <h2 className="text-lg font-semibold">
          Workshop modifications{" "}
          <span className="text-sm font-normal text-zinc-500">({mods.length})</span>
        </h2>
        <p className="-mt-2 text-sm text-zinc-400">
          What your shop can fabricate — offered in the builder and listed on the build
          sheet. Zones are comma-separated (street, curb, rear, front, roof).
        </p>

        <form
          action={addModAction}
          className="grid items-end gap-3 rounded-xl border border-white/10 bg-ink-soft/60 p-4 sm:grid-cols-[1.6fr_1fr_0.8fr_0.8fr_1.2fr_auto]"
        >
          <Mini label="Name">
            <input name="name" required placeholder="Cut serving window" className="vinput" />
          </Mini>
          <Mini label="Category">
            <select name="category" defaultValue="exterior" className="vinput">
              {MOD_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Mini>
          <Mini label="Price $">
            <input name="unit_price" type="number" step="1" defaultValue={0} className="vinput" />
          </Mini>
          <Mini label="Hours">
            <input name="labor_hours" type="number" step="0.5" defaultValue={0} className="vinput" />
          </Mini>
          <Mini label="Zones">
            <input name="allowed_zones" placeholder="street, curb" className="vinput" />
          </Mini>
          <SubmitButton pendingLabel="…">Add</SubmitButton>
        </form>

        {mods.length === 0 ? (
          <Empty>No modifications yet.</Empty>
        ) : (
          <div className="space-y-2">
            {mods.map((m) => (
              <ModRow key={m.id} m={m} />
            ))}
          </div>
        )}
      </section>

      <style>{`
        .vinput {
          width: 100%;
          border-radius: 0.4rem;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.03);
          padding: 0.4rem 0.5rem;
          font-size: 0.8rem;
          color: #f4f4f5;
          outline: none;
        }
        .vinput::placeholder { color: #71717a; }
        .vinput:focus { border-color: #f0962a; box-shadow: 0 0 0 1px #f0962a; }
      `}</style>
    </div>
  );
}

function VehicleRow({ v }: { v: VehicleModel }) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-soft/60 p-3">
      <form
        action={updateVehicleAction}
        className="grid items-end gap-2 sm:grid-cols-[1.8fr_repeat(7,0.8fr)_auto]"
      >
        <input type="hidden" name="id" value={v.id} />
        <Mini label="Label">
          <input name="label" defaultValue={v.label} className="vinput" />
        </Mini>
        <Mini label="Len">
          <input name="length_ft" type="number" step="0.5" defaultValue={v.length_ft} className="vinput" />
        </Mini>
        <Mini label="Wid">
          <input name="width_ft" type="number" step="0.1" defaultValue={v.width_ft} className="vinput" />
        </Mini>
        <Mini label="Hgt">
          <input name="height_ft" type="number" step="0.1" defaultValue={v.height_ft} className="vinput" />
        </Mini>
        <Mini label="Cab">
          <input name="cab_length_ft" type="number" step="0.5" defaultValue={v.cab_length_ft} className="vinput" />
        </Mini>
        <Mini label="Axles (ft, csv)">
          <input name="axle_positions" defaultValue={v.axle_positions.join(", ")} className="vinput" />
        </Mini>
        <Mini label="GVWR lb">
          <input name="gvwr_lbs" type="number" step="100" defaultValue={v.gvwr_lbs} className="vinput" />
        </Mini>
        <Mini label="Curb lb">
          <input name="curb_weight_lbs" type="number" step="100" defaultValue={v.curb_weight_lbs ?? 0} className="vinput" />
        </Mini>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-zinc-400">
            <input name="is_trailer" type="checkbox" defaultChecked={v.is_trailer} className="h-4 w-4 accent-[#f0962a]" />
            trailer
          </label>
          <button className="rounded-md border border-white/12 px-2 py-1 text-xs text-zinc-300 hover:bg-white/5">
            Save
          </button>
        </div>
      </form>
      <form action={deleteVehicleAction} className="mt-1.5 text-right">
        <input type="hidden" name="id" value={v.id} />
        <button className="text-[11px] text-red-300/70 hover:text-red-300">Delete vehicle</button>
      </form>
    </div>
  );
}

function ModRow({ m }: { m: WorkshopMod }) {
  return (
    <form
      action={updateModAction}
      className="grid items-end gap-2 rounded-xl border border-white/10 bg-ink-soft/60 p-3 sm:grid-cols-[1.6fr_1fr_0.8fr_0.8fr_1.2fr_auto]"
    >
      <input type="hidden" name="id" value={m.id} />
      <Mini label="Name">
        <input name="name" defaultValue={m.name} className="vinput" />
      </Mini>
      <Mini label="Category">
        <select name="category" defaultValue={m.category} className="vinput">
          {MOD_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Mini>
      <Mini label="Price $">
        <input name="unit_price" type="number" step="1" defaultValue={m.unit_price} className="vinput" />
      </Mini>
      <Mini label="Hours">
        <input name="labor_hours" type="number" step="0.5" defaultValue={m.labor_hours} className="vinput" />
      </Mini>
      <Mini label="Zones">
        <input name="allowed_zones" defaultValue={m.allowed_zones.join(", ")} className="vinput" />
      </Mini>
      <div className="flex items-center gap-2">
        <button className="rounded-md border border-white/12 px-2 py-1 text-xs text-zinc-300 hover:bg-white/5">
          Save
        </button>
      </div>
      <span className="sm:col-span-6 text-right">
        <button
          formAction={deleteModAction}
          className="text-[11px] text-red-300/70 hover:text-red-300"
        >
          Delete
        </button>
      </span>
    </form>
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

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-soft/60 p-8 text-center text-sm text-zinc-400">
      {children}
    </div>
  );
}
