import { buildTruckScene } from "@/lib/truck/model";
import type { BuildSpec, Decal, VehicleModel } from "@/lib/types";

// A scale 2D side elevation drawn straight from the build scene, so it always
// matches the 3D view and the build sheet. Pure SVG — server-renderable, no
// three.js. Front is drawn on the left.

type Side = "street" | "curb";

const SCALE = 22; // px per foot
const WHEEL_R = 1.3;

export function TruckElevation({
  spec,
  vehicle,
  side,
  showEquipment = true,
  className,
}: {
  spec: BuildSpec;
  vehicle?: VehicleModel | null;
  side?: Side;
  showEquipment?: boolean;
  className?: string;
}) {
  const scene = buildTruckScene(spec, vehicle);
  const L = scene.lengthFt;
  const totalH = scene.heightFt;
  const floorY = scene.floorY;
  const isTrailer = scene.isTrailer;
  const cabLen = isTrailer ? 0 : vehicle?.cab_length_ft ?? 4;
  const noseLen = isTrailer ? 2 : cabLen; // drawing space ahead of the body
  const bodyLeft = noseLen;

  // Default to the side the customer faces: prefer the serving-window side.
  const shown: Side =
    side ??
    (spec.exterior.servingWindows.find((w) => w.side === "curb")
      ? "curb"
      : spec.exterior.servingWindows.find((w) => w.side === "street")
        ? "street"
        : "curb");

  const totalWft = noseLen + L;
  const padFt = 1;
  const w = (totalWft + padFt * 2) * SCALE;
  const h = (totalH + padFt + 0.6) * SCALE;

  // feet -> screen px. Front on the left; y flipped (ground at bottom).
  const sx = (fromFrontFt: number) => (padFt + bodyLeft + fromFrontFt) * SCALE;
  const sxRaw = (xft: number) => (padFt + xft) * SCALE;
  const sy = (heightFt: number) => (padFt + totalH - heightFt) * SCALE;

  const bodyTop = totalH;
  const zSign = shown === "street" ? 1 : -1;

  // Equipment on the shown side, projected to (length, height).
  const equip = showEquipment
    ? scene.equipment
        .filter((b) => Math.sign(b.position[2]) === zSign || b.position[2] === 0)
        .map((b) => {
          const fromFrontCenter = L / 2 - b.position[0];
          return {
            xFt: fromFrontCenter,
            wFt: b.size[0],
            hFt: b.size[1],
            yCenter: b.position[1],
            color: b.color,
            label: b.label ?? "",
          };
        })
    : [];

  const windows = spec.exterior.servingWindows.filter((win) => win.side === shown);
  const decals = spec.exterior.decals.filter((d) => d.side === shown);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className ?? "w-full"}
      style={{ maxHeight: 360 }}
      role="img"
      aria-label="Truck side elevation"
    >
      {/* ground */}
      <line x1={0} y1={sy(0)} x2={w} y2={sy(0)} stroke="#cbd5e1" strokeWidth={1.5} />

      {/* nose: cab (truck) or tongue (trailer) */}
      {isTrailer ? (
        <line
          x1={sxRaw(0)}
          y1={sy(floorY - 0.2)}
          x2={sxRaw(noseLen)}
          y2={sy(floorY - 0.2)}
          stroke="#52525b"
          strokeWidth={3}
        />
      ) : (
        <>
          <path
            d={`M ${sxRaw(0)} ${sy(floorY + 3.2)}
                L ${sxRaw(noseLen * 0.55)} ${sy(floorY + 3.2)}
                L ${sxRaw(noseLen)} ${sy(floorY + 2.0)}
                L ${sxRaw(noseLen)} ${sy(floorY)}
                L ${sxRaw(0)} ${sy(floorY)} Z`}
            fill={scene.bodyColor}
            stroke="#1f2937"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          {/* windshield */}
          <path
            d={`M ${sxRaw(noseLen * 0.6)} ${sy(floorY + 3.1)}
                L ${sxRaw(noseLen * 0.97)} ${sy(floorY + 2.2)}
                L ${sxRaw(noseLen * 0.97)} ${sy(floorY + 1.4)}
                L ${sxRaw(noseLen * 0.6)} ${sy(floorY + 1.4)} Z`}
            fill="#bae6fd"
            stroke="#1f2937"
            strokeWidth={1}
          />
        </>
      )}

      {/* body shell */}
      <rect
        x={sx(0)}
        y={sy(bodyTop)}
        width={L * SCALE}
        height={(bodyTop - floorY) * SCALE}
        fill={scene.bodyColor}
        stroke="#1f2937"
        strokeWidth={1.5}
      />
      {/* accent roof band */}
      <rect
        x={sx(0)}
        y={sy(bodyTop)}
        width={L * SCALE}
        height={0.5 * SCALE}
        fill={scene.accentColor}
      />

      {/* equipment silhouettes (behind the wall) */}
      {equip.map((e, i) => (
        <g key={`eq-${i}`} opacity={0.5}>
          <rect
            x={sx(e.xFt - e.wFt / 2)}
            y={sy(e.yCenter + e.hFt / 2)}
            width={e.wFt * SCALE}
            height={e.hFt * SCALE}
            fill={e.color}
            stroke="#1f2937"
            strokeWidth={0.75}
            rx={2}
          />
        </g>
      ))}
      {equip.map((e, i) => (
        <text
          key={`eql-${i}`}
          x={sx(e.xFt)}
          y={sy(e.yCenter)}
          fontSize={9}
          fill="#0f172a"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {e.label}
        </text>
      ))}

      {/* serving window(s) */}
      {windows.map((win, i) => {
        const wFt = Math.min(win.widthIn / 12, L - 2);
        const yc = floorY + (bodyTop - floorY) * 0.55;
        const winH = 2.6;
        return (
          <rect
            key={`win-${i}`}
            x={sx(L / 2 - wFt / 2)}
            y={sy(yc + winH / 2)}
            width={wFt * SCALE}
            height={winH * SCALE}
            fill="#0f172a"
            fillOpacity={0.78}
            stroke="#0f172a"
            strokeWidth={1.5}
          />
        );
      })}

      {/* decals / logos (real artwork) */}
      {decals.map((d: Decal) => {
        const wFt = Math.min(d.widthFt, L - 1);
        const hFt = wFt * (d.aspect || 1);
        return (
          <image
            key={d.id}
            href={d.url}
            x={sx(d.xFt - wFt / 2)}
            y={sy(d.heightFt + hFt / 2)}
            width={wFt * SCALE}
            height={hFt * SCALE}
            preserveAspectRatio="xMidYMid meet"
          />
        );
      })}

      {/* wheels */}
      {wheelXs(scene, vehicle, L, isTrailer).map((xf, i) => (
        <circle
          key={`wheel-${i}`}
          cx={sx(xf)}
          cy={sy(WHEEL_R)}
          r={WHEEL_R * SCALE}
          fill="#18181b"
          stroke="#3f3f46"
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}

// Axle x-positions (ft from front of body) for the side view.
function wheelXs(
  scene: ReturnType<typeof buildTruckScene>,
  vehicle: VehicleModel | null | undefined,
  L: number,
  isTrailer: boolean,
): number[] {
  if (vehicle && vehicle.axle_positions.length) return vehicle.axle_positions;
  return isTrailer ? [L * 0.68, L * 0.84] : [L * 0.78, -1.5];
}
