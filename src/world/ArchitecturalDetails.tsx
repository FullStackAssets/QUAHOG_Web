import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";
import type { Building } from "../slice";
import {
  generateArchitecturalDetails,
  type ArchitecturalDetail,
  type DetailKind,
} from "./architecturalLayout";

// A few instanced pieces add depth and neighborhood variation without
// multiplying draw calls per building. Entirely decorative: no new colliders.
const KINDS: DetailKind[] = [
  "door", "storefront", "awning", "shopSign", "fireLanding", "fireRail", "roofTank",
];
const COLORS = ["#294956", "#7a3b2e", "#385948", "#9a7a57", "#364454"];

function DetailBatch({
  kind, details, high,
}: {
  kind: DetailKind;
  details: ArchitecturalDetail[];
  high: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const instances = useMemo(() => details.filter((d) => d.kind === kind), [details, kind]);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const obj = new THREE.Object3D();
    for (let i = 0; i < instances.length; i++) {
      const d = instances[i];
      obj.position.set(...d.position);
      obj.rotation.set(0, d.rotationY, 0);
      obj.scale.set(...d.scale);
      obj.updateMatrix();
      m.setMatrixAt(i, obj.matrix);
      if (kind === "door" || kind === "awning" || kind === "shopSign") {
        m.setColorAt(i, new THREE.Color(COLORS[d.colorIndex % COLORS.length]));
      }
    }
    m.count = instances.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [instances, kind]);

  if (!instances.length) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, instances.length]}
      castShadow={high}
      receiveShadow={high}
      frustumCulled
    >
      {kind === "roofTank" ? (
        <cylinderGeometry args={[0.5, 0.55, 1, 10]} />
      ) : (
        <boxGeometry args={[1, 1, 1]} />
      )}
      {kind === "storefront" ? (
        <meshStandardMaterial color="#345060" roughness={0.23} metalness={0.28} envMapIntensity={1.1} />
      ) : kind === "fireLanding" || kind === "fireRail" ? (
        <meshStandardMaterial color="#34393d" roughness={0.59} metalness={0.66} />
      ) : kind === "roofTank" ? (
        <meshStandardMaterial color="#5e716a" roughness={0.83} metalness={0.16} />
      ) : (
        <meshStandardMaterial color="#ffffff" roughness={0.75} metalness={0.08} />
      )}
    </instancedMesh>
  );
}

/** Only mounted on collision-near tiles, not all 49 streamed distant tiles. */
export function ArchitecturalDetails({ buildings }: { buildings: Building[] }) {
  const quality = useGame((s) => s.quality);
  const details = useMemo(() => generateArchitecturalDetails(buildings, [12, 34, 70][quality]), [buildings, quality]);
  // On Low, keep a little storefront life without adding fire-escape, rail,
  // and tank batches to every nearby tile on an iPhone GPU.
  const visibleKinds = quality === 0 ? KINDS.filter((kind) => ["door", "storefront", "awning"].includes(kind)) : KINDS;
  return (
    <group>
      {visibleKinds.map((kind) => (
        <DetailBatch key={kind} kind={kind} details={details} high={quality === 2} />
      ))}
    </group>
  );
}
