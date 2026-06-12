import type {
  BuildSpec,
  ServingWindow,
  ServingWindowSide,
  SpecEquipment,
  TruckType,
} from "./types";

const SERVING_SIDES: ServingWindowSide[] = ["street", "curb", "rear", "front"];

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x).trim()).filter(Boolean);
}

function normalizeEquipment(v: unknown): SpecEquipment[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((e) => {
      const o = (e ?? {}) as Partial<SpecEquipment>;
      const item: SpecEquipment = {
        name: str(o.name).trim(),
        type: str(o.type, "equipment").trim() || "equipment",
        location: str(o.location).trim(),
        specs: str(o.specs).trim(),
      };
      if (o.lengthFt != null) item.lengthFt = num(o.lengthFt, 3);
      if (o.depthFt != null) item.depthFt = num(o.depthFt, 2.2);
      const pos = o.position as Partial<SpecEquipment["position"]>;
      if (pos && (pos.side === "street" || pos.side === "curb")) {
        item.position = { xFt: num(pos.xFt, 0), side: pos.side };
      }
      return item;
    })
    .filter((e) => e.name.length > 0);
}

function normalizeServingWindows(v: unknown): ServingWindow[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((w) => {
      const o = (w ?? {}) as Partial<ServingWindow>;
      const side = SERVING_SIDES.includes(o.side as ServingWindowSide)
        ? (o.side as ServingWindowSide)
        : "curb";
      return { side, widthIn: num(o.widthIn, 36) };
    })
    .filter((w) => w.widthIn > 0);
}

/**
 * Coerce whatever the AI (or an edit form) produced into a complete, internally
 * consistent BuildSpec. Never throws — missing fields get sensible defaults so
 * downstream code (quote generation, 3D viewer) can rely on the shape.
 */
export function normalizeBuildSpec(
  raw: Partial<BuildSpec> | null | undefined,
  fallbackTruckType: TruckType = "food_truck",
): BuildSpec {
  const r = (raw ?? {}) as Partial<BuildSpec>;
  const dims = (r.dimensions ?? {}) as Partial<BuildSpec["dimensions"]>;
  const power = (r.power ?? {}) as Partial<BuildSpec["power"]>;
  const plumbing = (r.plumbing ?? {}) as Partial<BuildSpec["plumbing"]>;
  const exterior = (r.exterior ?? {}) as Partial<BuildSpec["exterior"]>;
  const interior = (r.interior ?? {}) as Partial<BuildSpec["interior"]>;

  return {
    summary: str(r.summary).trim(),
    truckType: (r.truckType as TruckType) || fallbackTruckType,
    baseVehicle: str(r.baseVehicle).trim(),
    dimensions: {
      lengthFt: num(dims.lengthFt, 20),
      widthFt: num(dims.widthFt, 8),
      heightFt: num(dims.heightFt, 9),
    },
    equipment: normalizeEquipment(r.equipment),
    power: {
      generatorKw: num(power.generatorKw, 0),
      shorePower: Boolean(power.shorePower),
      batteries: Boolean(power.batteries),
      solar: Boolean(power.solar),
      notes: str(power.notes).trim(),
    },
    plumbing: {
      freshTankGal: num(plumbing.freshTankGal, 0),
      greyTankGal: num(plumbing.greyTankGal, 0),
      sinks: num(plumbing.sinks, 0),
      waterHeater: Boolean(plumbing.waterHeater),
      notes: str(plumbing.notes).trim(),
    },
    exterior: {
      paintColor: str(exterior.paintColor).trim(),
      wrap: str(exterior.wrap).trim(),
      servingWindows: normalizeServingWindows(exterior.servingWindows),
    },
    interior: {
      flooring: str(interior.flooring).trim(),
      finishes: str(interior.finishes).trim(),
    },
    mustHaves: strList(r.mustHaves),
    openQuestions: strList(r.openQuestions),
  };
}

export function emptyBuildSpec(truckType: TruckType = "food_truck"): BuildSpec {
  return normalizeBuildSpec({ truckType }, truckType);
}

/** True when no meaningful content has been extracted yet. */
export function isBlankSpec(spec: BuildSpec | null | undefined): boolean {
  if (!spec) return true;
  return (
    !spec.summary &&
    !spec.baseVehicle &&
    spec.equipment.length === 0 &&
    spec.mustHaves.length === 0
  );
}

// ----- Form <-> spec serialization ------------------------------------------
// The spec-review form encodes list fields as plain text (one entry per line)
// so the estimator can edit them without a complex UI.

export function equipmentToLines(equipment: SpecEquipment[]): string {
  return equipment
    .map((e) =>
      [e.name, e.type, e.location, e.specs]
        .join(" | ")
        .replace(/(\s*\|\s*)+$/, ""),
    )
    .join("\n");
}

export function linesToEquipment(text: string): SpecEquipment[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", type = "", location = "", specs = ""] = line
        .split("|")
        .map((p) => p.trim());
      return { name, type: type || "equipment", location, specs };
    })
    .filter((e) => e.name);
}

export function windowsToLines(windows: ServingWindow[]): string {
  return windows.map((w) => `${w.side} ${w.widthIn}`).join("\n");
}

export function linesToWindows(text: string): ServingWindow[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [side = "curb", width = "36"] = line.split(/\s+/);
      return {
        side: side as ServingWindow["side"],
        widthIn: Number(width) || 36,
      };
    });
}

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Rebuild a BuildSpec from the spec-review form submission. */
export function specFromForm(
  formData: FormData,
  fallbackTruckType: TruckType,
): BuildSpec {
  const s = (name: string) => String(formData.get(name) ?? "");
  const n = (name: string) => Number(formData.get(name) ?? 0) || 0;
  const b = (name: string) => formData.get(name) != null;
  return normalizeBuildSpec(
    {
      summary: s("summary"),
      truckType: (s("truckType") || fallbackTruckType) as TruckType,
      baseVehicle: s("baseVehicle"),
      dimensions: {
        lengthFt: n("lengthFt"),
        widthFt: n("widthFt"),
        heightFt: n("heightFt"),
      },
      equipment: linesToEquipment(s("equipment")),
      power: {
        generatorKw: n("generatorKw"),
        shorePower: b("shorePower"),
        batteries: b("batteries"),
        solar: b("solar"),
        notes: s("powerNotes"),
      },
      plumbing: {
        freshTankGal: n("freshTankGal"),
        greyTankGal: n("greyTankGal"),
        sinks: n("sinks"),
        waterHeater: b("waterHeater"),
        notes: s("plumbingNotes"),
      },
      exterior: {
        paintColor: s("paintColor"),
        wrap: s("wrap"),
        servingWindows: linesToWindows(s("servingWindows")),
      },
      interior: { flooring: s("flooring"), finishes: s("finishes") },
      mustHaves: lines(s("mustHaves")),
      openQuestions: lines(s("openQuestions")),
    },
    fallbackTruckType,
  );
}

/**
 * Render a BuildSpec as a compact text block for inclusion in the AI prompt
 * when generating the quote (so the estimate reflects the structured spec).
 */
export function specToPromptText(spec: BuildSpec): string {
  const lines: string[] = [];
  if (spec.summary) lines.push(`Summary: ${spec.summary}`);
  lines.push(`Base vehicle: ${spec.baseVehicle || "(unspecified)"}`);
  lines.push(
    `Dimensions: ${spec.dimensions.lengthFt}ft L x ${spec.dimensions.widthFt}ft W x ${spec.dimensions.heightFt}ft H`,
  );
  if (spec.equipment.length) {
    lines.push("Equipment:");
    for (const e of spec.equipment) {
      const detail = [e.type, e.location, e.specs].filter(Boolean).join(", ");
      lines.push(`  - ${e.name}${detail ? ` (${detail})` : ""}`);
    }
  }
  const power = [
    spec.power.generatorKw ? `${spec.power.generatorKw}kW generator` : "",
    spec.power.shorePower ? "shore power" : "",
    spec.power.batteries ? "battery bank" : "",
    spec.power.solar ? "solar" : "",
    spec.power.notes,
  ]
    .filter(Boolean)
    .join(", ");
  if (power) lines.push(`Power: ${power}`);
  const plumbing = [
    spec.plumbing.freshTankGal ? `${spec.plumbing.freshTankGal}gal fresh` : "",
    spec.plumbing.greyTankGal ? `${spec.plumbing.greyTankGal}gal grey` : "",
    spec.plumbing.sinks ? `${spec.plumbing.sinks} sink(s)` : "",
    spec.plumbing.waterHeater ? "water heater" : "",
    spec.plumbing.notes,
  ]
    .filter(Boolean)
    .join(", ");
  if (plumbing) lines.push(`Plumbing: ${plumbing}`);
  const windows = spec.exterior.servingWindows
    .map((w) => `${w.side} ${w.widthIn}in`)
    .join(", ");
  const exterior = [
    spec.exterior.paintColor ? `paint: ${spec.exterior.paintColor}` : "",
    spec.exterior.wrap ? `wrap/graphics: ${spec.exterior.wrap}` : "",
    windows ? `serving windows: ${windows}` : "",
  ]
    .filter(Boolean)
    .join("; ");
  if (exterior) lines.push(`Exterior: ${exterior}`);
  const interior = [spec.interior.flooring, spec.interior.finishes]
    .filter(Boolean)
    .join("; ");
  if (interior) lines.push(`Interior: ${interior}`);
  if (spec.mustHaves.length)
    lines.push(`Must-haves: ${spec.mustHaves.join("; ")}`);
  if (spec.openQuestions.length)
    lines.push(`Open questions: ${spec.openQuestions.join("; ")}`);
  return lines.join("\n");
}
