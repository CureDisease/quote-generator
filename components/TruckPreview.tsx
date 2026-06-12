"use client";

import dynamic from "next/dynamic";
import type { BuildSpec, VehicleModel } from "@/lib/types";

// three.js can't render on the server — load the viewer client-side only.
const TruckViewer = dynamic(() => import("./TruckViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">
      Loading 3D preview…
    </div>
  ),
});

export function TruckPreview({
  spec,
  vehicle,
  className,
}: {
  spec: BuildSpec;
  vehicle?: VehicleModel | null;
  className?: string;
}) {
  return (
    <div
      className={
        className ??
        "h-80 w-full overflow-hidden rounded-xl border border-white/10 bg-[#101013]"
      }
    >
      <TruckViewer spec={spec} vehicle={vehicle} />
    </div>
  );
}
