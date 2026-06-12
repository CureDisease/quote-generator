import type { BuildSpec } from "../types";

// Deterministic BuildSpec -> 3D scene description. Pure data — the viewer
// (components/TruckViewer.tsx) maps these to meshes. 1 unit = 1 foot.

export interface Box {
  // center position [x (along length), y (up), z (across width)]
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  label?: string;
  opacity?: number;
}

export interface Cylinder {
  position: [number, number, number];
  radius: number;
  width: number; // along z
  color: string;
}

export interface TruckScene {
  lengthFt: number;
  widthFt: number;
  heightFt: number;
  bodyColor: string;
  isTrailer: boolean;
  body: Box[]; // shell panels (semi-transparent so equipment shows)
  cab: Box[];
  windows: Box[]; // serving windows inset into the walls
  equipment: Box[];
  wheels: Cylinder[];
  floorY: number;
}

// Map common color words in the paint/wrap description to render colors.
const COLOR_WORDS: [RegExp, string][] = [
  [/\bred\b/i, "#b91c1c"],
  [/\bmaroon|burgundy\b/i, "#7f1d1d"],
  [/\borange\b/i, "#ea580c"],
  [/\bgold(en)?\b/i, "#ca8a04"],
  [/\byellow\b/i, "#eab308"],
  [/\bgreen\b/i, "#15803d"],
  [/\bteal\b/i, "#0d9488"],
  [/\bnavy\b/i, "#1e3a5f"],
  [/\bblue\b/i, "#1d4ed8"],
  [/\bpurple|violet\b/i, "#7c3aed"],
  [/\bpink\b/i, "#db2777"],
  [/\bblack\b/i, "#27272a"],
  [/\bwhite|cream\b/i, "#e4e4e7"],
  [/\bsilver|gray|grey\b/i, "#9ca3af"],
  [/\bbrown|copper\b/i, "#92400e"],
];

export function bodyColorFor(spec: BuildSpec): string {
  const text = `${spec.exterior.paintColor} ${spec.exterior.wrap}`;
  for (const [re, hex] of COLOR_WORDS) {
    if (re.test(text)) return hex;
  }
  return "#d4d4d8"; // unpainted aluminum
}

// Equipment block color by type.
const EQUIPMENT_COLORS: Record<string, string> = {
  cooking: "#dc2626",
  refrigeration: "#2563eb",
  sink: "#06b6d4",
  prep: "#16a34a",
  ventilation: "#a1a1aa",
  storage: "#a16207",
  equipment: "#71717a",
};

export function equipmentColorFor(type: string): string {
  return EQUIPMENT_COLORS[type?.toLowerCase()] ?? EQUIPMENT_COLORS.equipment;
}

const WALL = 0.25; // wall thickness, ft

export function buildTruckScene(spec: BuildSpec): TruckScene {
  const L = clamp(spec.dimensions.lengthFt, 10, 40);
  const W = clamp(spec.dimensions.widthFt, 6, 10);
  const isTrailer = spec.truckType === "bbq_smoker_trailer";
  const wheelR = 1.3;
  const floorY = wheelR + 0.6; // floor height above ground
  const bodyH = clamp(spec.dimensions.heightFt, 7, 12) - floorY;
  const bodyColor = bodyColorFor(spec);

  // --- shell -----------------------------------------------------------------
  // Opaque floor + roof, semi-transparent walls so the galley reads through.
  const body: Box[] = [
    { position: [0, floorY + WALL / 2, 0], size: [L, WALL, W], color: "#3f3f46" }, // floor
    { position: [0, floorY + bodyH - WALL / 2, 0], size: [L, WALL, W], color: bodyColor, opacity: 0.55 }, // roof
    // street side (+z) and curb side (-z)
    { position: [0, floorY + bodyH / 2, W / 2 - WALL / 2], size: [L, bodyH, WALL], color: bodyColor, opacity: 0.32 },
    { position: [0, floorY + bodyH / 2, -(W / 2 - WALL / 2)], size: [L, bodyH, WALL], color: bodyColor, opacity: 0.32 },
    // front (+x) and rear (-x)
    { position: [L / 2 - WALL / 2, floorY + bodyH / 2, 0], size: [WALL, bodyH, W], color: bodyColor, opacity: 0.32 },
    { position: [-(L / 2 - WALL / 2), floorY + bodyH / 2, 0], size: [WALL, bodyH, W], color: bodyColor, opacity: 0.32 },
  ];

  // --- cab / drawbar ----------------------------------------------------------
  const cab: Box[] = [];
  if (isTrailer) {
    // tongue + hitch
    cab.push({ position: [L / 2 + 1.5, floorY - 0.2, 0], size: [3, 0.3, 0.3], color: "#52525b" });
  } else {
    const cabL = 4;
    cab.push(
      { position: [L / 2 + cabL / 2, floorY + 1.6, 0], size: [cabL, 3.2, W * 0.92], color: bodyColor },
      // windshield
      { position: [L / 2 + cabL - 0.3, floorY + 2.4, 0], size: [0.2, 1.3, W * 0.7], color: "#7dd3fc" },
    );
  }

  // --- serving windows ---------------------------------------------------------
  const windows: Box[] = spec.exterior.servingWindows.map((w) => {
    const widthFt = clamp(w.widthIn / 12, 2, Math.min(8, L - 3));
    const winH = 2.6;
    const y = floorY + bodyH * 0.55;
    switch (w.side) {
      case "street":
        return { position: [0, y, W / 2 - WALL / 2], size: [widthFt, winH, WALL * 1.6], color: "#0f172a", label: "Serving window" };
      case "curb":
        return { position: [0, y, -(W / 2 - WALL / 2)], size: [widthFt, winH, WALL * 1.6], color: "#0f172a", label: "Serving window" };
      case "front":
        return { position: [L / 2 - WALL / 2, y, 0], size: [WALL * 1.6, winH, widthFt], color: "#0f172a", label: "Serving window" };
      case "rear":
      default:
        return { position: [-(L / 2 - WALL / 2), y, 0], size: [WALL * 1.6, winH, widthFt], color: "#0f172a", label: "Serving window" };
    }
  });

  // --- equipment layout --------------------------------------------------------
  // Place blocks in two runs along the interior walls (street run first unless
  // the item's location mentions the other side), packed front -> rear.
  const equipment: Box[] = [];
  const usableL = L - 2; // keep clear of front/rear walls
  const depth = Math.min(2.2, W / 3.2); // counter depth
  // Length consumed along each wall, packed front (+x) toward rear (-x).
  const consumed: Record<"street" | "curb", number> = { street: 0, curb: 0 };

  const items = [...spec.equipment];
  // Generator + tanks read better as implied items if specified but not listed.
  if (spec.power.generatorKw > 0 && !items.some((e) => /generator/i.test(e.name))) {
    items.push({
      name: `Generator (${spec.power.generatorKw}kW)`,
      type: "equipment",
      location: "rear",
      specs: "",
    });
  }

  for (const item of items.slice(0, 14)) {
    const side: "street" | "curb" = /curb|passenger|right/i.test(item.location)
      ? "curb"
      : /street|driver|left/i.test(item.location)
        ? "street"
        : consumed.street <= consumed.curb
          ? "street"
          : "curb";
    const remaining = usableL - consumed[side];
    const blockL = Math.min(3, remaining);
    if (blockL < 1.2) continue; // out of room — skip rather than overflow
    const isVent = item.type?.toLowerCase() === "ventilation";
    const h = isVent ? 1.2 : 3;
    const xPos = usableL / 2 - consumed[side] - blockL / 2;
    const z = side === "street" ? W / 2 - WALL - depth / 2 : -(W / 2 - WALL - depth / 2);
    equipment.push({
      position: [xPos, isVent ? floorY + bodyH - 1 : floorY + WALL + h / 2, z],
      size: [blockL, h, depth],
      color: equipmentColorFor(item.type),
      label: item.name,
    });
    consumed[side] += blockL + 0.4;
  }

  // --- wheels -------------------------------------------------------------------
  const wheelZ = W / 2 - 0.8;
  const wheelXs = isTrailer
    ? [-L * 0.18, -L * 0.02]
    : [L / 2 + 2.5, -L * 0.28];
  const wheels: Cylinder[] = wheelXs.flatMap((wx) => [
    { position: [wx, wheelR, wheelZ], radius: wheelR, width: 0.7, color: "#18181b" },
    { position: [wx, wheelR, -wheelZ], radius: wheelR, width: 0.7, color: "#18181b" },
  ]);

  return {
    lengthFt: L,
    widthFt: W,
    heightFt: floorY + bodyH,
    bodyColor,
    isTrailer,
    body,
    cab,
    windows,
    equipment,
    wheels,
    floorY,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number(n) || min));
}
