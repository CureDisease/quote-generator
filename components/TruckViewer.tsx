"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { useMemo } from "react";
import { buildTruckScene, type Box, type TruckScene } from "@/lib/truck/model";
import type { BuildSpec, VehicleModel } from "@/lib/types";

function BoxMesh({ box }: { box: Box }) {
  return (
    <mesh position={box.position}>
      <boxGeometry args={box.size} />
      <meshStandardMaterial
        color={box.color}
        transparent={box.opacity != null}
        opacity={box.opacity ?? 1}
        roughness={0.6}
        metalness={0.15}
      />
    </mesh>
  );
}

function Label({ box, scale }: { box: Box; scale: number }) {
  if (!box.label) return null;
  return (
    <Text
      position={[box.position[0], box.position[1] + box.size[1] / 2 + 0.45, box.position[2]]}
      fontSize={0.55 * scale}
      color="#fafafa"
      outlineWidth={0.03}
      outlineColor="#09090b"
      anchorX="center"
      anchorY="bottom"
    >
      {box.label}
    </Text>
  );
}

function TruckModel({ scene }: { scene: TruckScene }) {
  const labelScale = Math.max(0.8, scene.lengthFt / 22);
  return (
    <group>
      {scene.body.map((b, i) => (
        <BoxMesh key={`body-${i}`} box={b} />
      ))}
      {scene.cab.map((b, i) => (
        <BoxMesh key={`cab-${i}`} box={b} />
      ))}
      {scene.windows.map((b, i) => (
        <group key={`win-${i}`}>
          <BoxMesh box={b} />
          <Label box={b} scale={labelScale} />
        </group>
      ))}
      {scene.equipment.map((b, i) => (
        <group key={`eq-${i}`}>
          <BoxMesh box={b} />
          <Label box={b} scale={labelScale} />
        </group>
      ))}
      {scene.wheels.map((w, i) => (
        <mesh
          key={`wheel-${i}`}
          position={w.position}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[w.radius, w.radius, w.width, 24]} />
          <meshStandardMaterial color={w.color} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export default function TruckViewer({
  spec,
  vehicle,
}: {
  spec: BuildSpec;
  vehicle?: VehicleModel | null;
}) {
  const scene = useMemo(() => buildTruckScene(spec, vehicle), [spec, vehicle]);
  const camDist = scene.lengthFt * 1.15;

  return (
    <Canvas
      camera={{
        position: [camDist * 0.8, scene.heightFt * 1.2, camDist * 0.75],
        fov: 42,
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#101013"]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[30, 40, 20]} intensity={1.1} />
      <directionalLight position={[-20, 25, -25]} intensity={0.35} />
      <TruckModel scene={scene} />
      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#1b1b1f" roughness={1} />
      </mesh>
      <gridHelper
        args={[120, 60, "#2c2c33", "#222228"]}
        position={[0, 0.01, 0]}
      />
      <OrbitControls
        target={[0, scene.heightFt / 2, 0]}
        maxPolarAngle={Math.PI / 2 - 0.02}
        minDistance={6}
        maxDistance={camDist * 3}
      />
    </Canvas>
  );
}
