import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGame } from "../store";
import type { Building } from "../slice";
import { generateArchitecturalShell, type ShellKind, type ShellPiece } from "./architecturalShellLayout";

const KINDS: ShellKind[] = ["foundation", "cornice", "belt", "pier", "lintel", "chimney"];
function ShellBatch({ kind, pieces, shadows }: {kind: ShellKind; pieces: ShellPiece[]; shadows: boolean}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const batch = useMemo(() => pieces.filter(p => p.kind === kind), [pieces, kind]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const obj = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      obj.position.set(...item.position);
      obj.rotation.set(0, item.rotationY, 0);
      obj.scale.set(...item.scale);
      obj.updateMatrix();
      mesh.setMatrixAt(i, obj.matrix);
      mesh.setColorAt(i, color.set(item.color));
    }
    mesh.count = batch.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [batch]);
  if (!batch.length) return null;
  return <instancedMesh ref={ref} args={[undefined, undefined, batch.length]} castShadow={shadows} receiveShadow={shadows}>
    <boxGeometry args={[1, 1, 1]}/>
    <meshStandardMaterial color="white" roughness={kind === "cornice" ? 0.72 : 0.94} metalness={0}/>
  </instancedMesh>;
}

/** Architectural dressing is intentionally NOT parented to a RigidBody. */
export function ArchitecturalShell({ buildings }: { buildings: Building[] }) {
  const quality = useGame(s => s.quality);
  const pieces = useMemo(() => generateArchitecturalShell(buildings, [35, 120, 240][quality] ?? 35), [buildings, quality]);
  const visible = quality === 0 ? KINDS.filter(k => k === "foundation" || k === "cornice") : KINDS;
  return <group>{visible.map(kind => <ShellBatch key={kind} kind={kind} pieces={pieces} shadows={quality === 2}/>)}</group>;
}
