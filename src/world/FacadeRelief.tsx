import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";
import type { Building } from "../slice";
import { FACADE_WINDOW_HEIGHT, FACADE_WINDOW_WIDTH, generateFacadeRelief, type ReliefWindow } from "./facadeReliefLayout";

const _object = new THREE.Object3D();
const STRIP = 0.09;

/**
 * Real depth for the close-up facades. All four rails, sill and glazing are
 * batched, with existing texture windows as a matching fallback at distance.
 * These are decorative: never create collision or game-state entities.
 */
function ReliefBatch({ windows, kind }: { windows: ReliefWindow[]; kind: "glass" | "trim" }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const quantity = windows.length * (kind === "trim" ? 4 : 1);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    let index = 0;
    for (const w of windows) {
      _object.rotation.set(0, w.yaw, 0);
      const add = (offX: number, offY: number, out: number, sx: number, sy: number, sz: number) => {
        const sin = Math.sin(w.yaw), cos = Math.cos(w.yaw);
        _object.position.set(w.x + offX * cos + out * sin, w.y + offY, w.z - offX * sin + out * cos);
        _object.scale.set(sx, sy, sz);
        _object.updateMatrix();
        m.setMatrixAt(index++, _object.matrix);
      };
      if (kind === "glass") {
        add(0, 0, 0.12, FACADE_WINDOW_WIDTH - 0.09, FACADE_WINDOW_HEIGHT - 0.10, 0.024);
      } else {
        add(-FACADE_WINDOW_WIDTH / 2 - 0.03, 0, 0.14, STRIP, FACADE_WINDOW_HEIGHT + 0.19, 0.14);
        add(FACADE_WINDOW_WIDTH / 2 + 0.03, 0, 0.14, STRIP, FACADE_WINDOW_HEIGHT + 0.19, 0.14);
        add(0, FACADE_WINDOW_HEIGHT / 2 + 0.085, 0.15, FACADE_WINDOW_WIDTH + 0.18, STRIP * 1.3, 0.18);
        add(0, -FACADE_WINDOW_HEIGHT / 2 - 0.075, 0.19, FACADE_WINDOW_WIDTH + 0.24, STRIP * 1.5, 0.23);
      }
    }
    m.count = index;
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [windows, kind]);
  if (!quantity) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, quantity]} frustumCulled castShadow={kind === "trim"}>
      <boxGeometry args={[1, 1, 1]} />
      {kind === "glass" ? (
        <meshPhysicalMaterial color="#345367" roughness={0.15} metalness={0} ior={1.5} envMapIntensity={1.15} clearcoat={0.32} clearcoatRoughness={0.13} />
      ) : (
        <meshStandardMaterial color="#bab8af" roughness={0.74} metalness={0.03} />
      )}
    </instancedMesh>
  );
}

export function FacadeRelief({ buildings }: { buildings: Building[] }) {
  const quality = useGame((s) => s.quality);
  const windows = useMemo(() => generateFacadeRelief(buildings, [30, 220, 440][quality] ?? 30), [buildings, quality]);
  return <group><ReliefBatch windows={windows} kind="glass" /><ReliefBatch windows={windows} kind="trim" /></group>;
}
