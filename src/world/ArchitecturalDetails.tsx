import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";
import type { Building } from "../slice";
import {
  DETAIL_KINDS, generateArchitecturalDetails,
  type DetailKind, type ArchitecturalDetail,
} from "./architecturalLayout";

// Each facade part is a single instanced draw call per near tile. The existing
// building geometry and Rapier collider remain the only gameplay authority.
const LOW_KINDS = new Set<DetailKind>(["door", "storefront", "sill"]);
const MEDIUM_KINDS = new Set<DetailKind>(["door", "storefront", "sill", "lintel", "roofUnit"]);
const DOOR_TONES = ["#345363", "#69463a", "#536851", "#77654e", "#4f5056"];
const object = new THREE.Object3D();

function DetailBatch({ kind, details, high }: {
  kind: DetailKind; details: ArchitecturalDetail[]; high: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const instances = useMemo(() => details.filter(d => d.kind === kind), [details, kind]);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    instances.forEach((d, i) => {
      object.position.set(...d.position);
      object.rotation.set(0, d.rotationY, 0);
      object.scale.set(...d.scale);
      object.updateMatrix();
      m.setMatrixAt(i, object.matrix);
      const base = kind === "door" ? DOOR_TONES[d.colorIndex % DOOR_TONES.length]
        : kind === "storefront" ? "#496475"
        : kind === "fireLanding" || kind === "fireRail" ? "#485158"
        : kind === "roofUnit" ? "#778081" : "#d3c9b8";
      m.setColorAt(i, new THREE.Color(base));
    });
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
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color="#ffffff"
        metalness={kind === "fireLanding" || kind === "fireRail" ? 0.62 :
          kind === "storefront" ? 0.16 : 0.04}
        roughness={kind === "storefront" ? 0.2 :
          kind === "fireLanding" || kind === "fireRail" ? 0.55 : 0.82}
        envMapIntensity={kind === "storefront" ? 1.0 : 0.65}
      />
    </instancedMesh>
  );
}

export function ArchitecturalDetails({ buildings }: { buildings: Building[] }) {
  const quality = useGame(s => s.quality);
  const allowed = quality === 0 ? LOW_KINDS : quality === 1 ? MEDIUM_KINDS : undefined;
  const details = useMemo(
    () => generateArchitecturalDetails(buildings, [18, 48, 100][quality], allowed),
    [buildings, quality],
  );
  const kinds = quality === 0 ? DETAIL_KINDS.filter(k => LOW_KINDS.has(k))
    : quality === 1 ? DETAIL_KINDS.filter(k => MEDIUM_KINDS.has(k)) : DETAIL_KINDS;
  return (
    <group>
      {kinds.map(kind => <DetailBatch key={kind} kind={kind} details={details} high={quality === 2} />)}
    </group>
  );
}
