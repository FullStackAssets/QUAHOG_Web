import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useGame } from "../store";
import type { Building } from "../slice";
import { BETHEL_FOOTPRINT, MARINERS_FOOTPRINT } from "./districtStyle";

// Visual trim follows the GIS perimeter. No duplicate building, collider,
// parcel, or fabricated navigable interior. Merged into two district draws.
export function DistrictDetails({ buildings }: { buildings: Building[] }) {
  const quality = useGame((s) => s.quality);
  const group = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const detail = useMemo(() => {
    const stone: THREE.BufferGeometry[] = [], timber: THREE.BufferGeometry[] = [];
    const add = (list: THREE.BufferGeometry[], x: number, y: number, z: number, w: number, h: number, d: number, yaw: number) => {
      const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
      g.rotateY(yaw); g.translate(x, y, z); list.push(g);
    };
    for (const b of buildings) {
      if (b.name === BETHEL_FOOTPRINT) continue; // separate chapel trim
      const fp = b.footprint;
      const cx = fp.reduce((a, p) => a + p[0], 0) / fp.length;
      const cz = -fp.reduce((a, p) => a + p[1], 0) / fp.length;
      if (Math.hypot(cx + 266, cz - 100) > (quality === 0 ? 90 : 160)) continue;
      const mariners = b.name === MARINERS_FOOTPRINT;
      let area = 0;
      for (let i = 0; i < fp.length; i++) { const a = fp[i], c = fp[(i + 1) % fp.length]; area += a[0] * -c[1] - c[0] * -a[1]; }
      const sign = area >= 0 ? 1 : -1;
      for (let i = 0; i < fp.length; i++) {
        const a = fp[i], c = fp[(i + 1) % fp.length];
        const dx = c[0] - a[0], dz = a[1] - c[1], len = Math.hypot(dx, dz);
        if (len < 2) continue;
        const nx = dz / len * sign, nz = -dx / len * sign;
        const x = (a[0] + c[0]) / 2, z = -(a[1] + c[1]) / 2, yaw = -Math.atan2(dz, dx);
        add(stone, x, 0.32, z, len, 0.55, 0.24, yaw);
        add(timber, x, b.height - 0.25, z, len + 0.12, mariners ? 0.4 : 0.22, mariners ? 0.5 : 0.32, yaw);
        if (quality === 0 && !mariners) continue;
        // Restrained projecting floor bands, not a mesh for every window pane.
        for (let floor = 3.2; floor < b.height - 0.7; floor += 3.2) {
          if (!mariners && floor > 9.6) break;
          add(stone, x + nx * 0.055, floor, z + nz * 0.055, len, 0.09, 0.20, yaw);
        }
        if (mariners) {
          add(timber, a[0], b.height / 2, -a[1], 0.2, b.height, 0.22, yaw);
          add(timber, x + nx * 0.12, b.height - 0.7, z + nz * 0.12, len, 0.14, 0.36, yaw);
        }
      }
    }
    const merge = (list: THREE.BufferGeometry[]) => {
      const merged = list.length ? mergeGeometries(list, false) : null;
      list.forEach((g) => g.dispose()); return merged;
    };
    return { stone: merge(stone), timber: merge(timber) };
  }, [buildings, quality]);
  useEffect(() => () => { detail.stone?.dispose(); detail.timber?.dispose(); }, [detail]);
  useFrame(() => { if (group.current) group.current.visible = Math.hypot(camera.position.x + 266, camera.position.z - 100) < (quality === 0 ? 140 : 240); });
  return <group ref={group}>
    {detail.stone && <mesh geometry={detail.stone} receiveShadow><meshStandardMaterial color="#b3b1a4" roughness={0.94} /></mesh>}
    {detail.timber && <mesh geometry={detail.timber} receiveShadow><meshStandardMaterial color="#dedbcd" roughness={0.86} /></mesh>}
  </group>;
}
