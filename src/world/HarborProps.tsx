import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// Working-waterfront dressing (§6): dock pilings along the harbor edge, bobbing
// buoys, and a couple of fishing boats riding the swell. Placement is derived
// from the OSM water polygon so the props hug the real shoreline.

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const RADIUS = 320;

export function HarborProps({
  polys,
  center,
}: {
  polys: [number, number][][];
  center: [number, number];
}) {
  const { pilings, buoys, boats, gear } = useMemo(() => {
    const pilings: [number, number][] = [];
    const buoys: [number, number][] = [];
    const boats: [number, number, number][] = []; // x, z, rot
    const ring = polys.reduce((a, b) => (b.length > a.length ? b : a), [] as [number, number][]);
    if (ring.length > 2) {
      let acc = 0;
      for (let i = 0; i < ring.length - 1; i++) {
        const [ax, an] = ring[i];
        const [bx, bn] = ring[i + 1];
        const x1 = ax, z1 = -an, x2 = bx, z2 = -bn;
        const seg = Math.hypot(x2 - x1, z2 - z1);
        const ux = (x2 - x1) / (seg || 1), uz = (z2 - z1) / (seg || 1);
        for (let d = 0; d < seg; d += 7) {
          acc++;
          const x = x1 + ux * d, z = z1 + uz * d;
          if (Math.hypot(x - center[0], z - center[1]) > RADIUS) continue;
          pilings.push([x, z]);
          // push a buoy slightly off the edge into the water now and then
          if (acc % 5 === 0) buoys.push([x - uz * 6, z + ux * 6]);
          if (acc % 17 === 0) boats.push([x - uz * 14, z + ux * 14, Math.atan2(ux, uz)]);
        }
      }
    }
    // stacked fishing gear (scallop dredges / traps) on the wharf, on the land side
    const gear: [number, number, number][] = [];
    for (let i = 0; i < pilings.length; i += 9) gear.push([pilings[i][0], pilings[i][1], (i * 1.7) % (Math.PI * 2)]);
    return {
      pilings: pilings.slice(0, 600),
      buoys: buoys.slice(0, 120),
      boats: boats.slice(0, 16),
      gear: gear.slice(0, 60),
    };
  }, [polys, center]);

  const pilingRef = useRef<THREE.InstancedMesh>(null);
  const buoyRef = useRef<THREE.InstancedMesh>(null);
  const gearRef = useRef<THREE.InstancedMesh>(null);
  const boatRefs = useRef<(THREE.Group | null)[]>([]);

  useLayoutEffect(() => {
    const pm = pilingRef.current;
    if (pm) {
      for (let i = 0; i < pilings.length; i++) {
        _q.identity();
        _m.compose(_p.set(pilings[i][0], 0.6, pilings[i][1]), _q, _s.set(1, 1, 1));
        pm.setMatrixAt(i, _m);
      }
      pm.count = pilings.length;
      pm.instanceMatrix.needsUpdate = true;
    }
    const gm = gearRef.current;
    if (gm) {
      for (let i = 0; i < gear.length; i++) {
        _q.setFromAxisAngle(_p.set(0, 1, 0), gear[i][2]);
        _m.compose(_p.set(gear[i][0], 0.55, gear[i][1]), _q, _s.set(1, 1, 1));
        gm.setMatrixAt(i, _m);
      }
      gm.count = gear.length;
      gm.instanceMatrix.needsUpdate = true;
    }
  }, [pilings, gear]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // bob the buoys
    const bm = buoyRef.current;
    if (bm) {
      for (let i = 0; i < buoys.length; i++) {
        const y = 0.25 + Math.sin(t * 1.6 + i) * 0.12;
        _q.setFromAxisAngle(_p.set(1, 0, 0), Math.sin(t + i) * 0.15);
        _m.compose(_p.set(buoys[i][0], y, buoys[i][1]), _q, _s.set(1, 1, 1));
        bm.setMatrixAt(i, _m);
      }
      bm.count = buoys.length;
      bm.instanceMatrix.needsUpdate = true;
    }
    // bob + roll the boats
    boats.forEach((b, i) => {
      const g = boatRefs.current[i];
      if (!g) return;
      g.position.set(b[0], 0.35 + Math.sin(t * 1.1 + i * 2) * 0.18, b[1]);
      g.rotation.set(Math.sin(t * 0.9 + i) * 0.06, b[2], Math.sin(t * 1.3 + i) * 0.08);
    });
  });

  return (
    <group>
      <instancedMesh ref={pilingRef} args={[undefined, undefined, Math.max(1, pilings.length)]} castShadow>
        <cylinderGeometry args={[0.22, 0.26, 2.2, 6]} />
        <meshStandardMaterial color="#3c2c1e" roughness={0.95} />
      </instancedMesh>

      <instancedMesh ref={buoyRef} args={[undefined, undefined, Math.max(1, buoys.length)]}>
        <sphereGeometry args={[0.35, 8, 6]} />
        <meshStandardMaterial color="#c0341f" roughness={0.5} emissive="#3a0a06" emissiveIntensity={0.3} />
      </instancedMesh>

      {/* stacked scallop dredges / traps on the wharf */}
      <instancedMesh ref={gearRef} args={[undefined, undefined, Math.max(1, gear.length)]} castShadow>
        <boxGeometry args={[1.4, 1.0, 1.4]} />
        <meshStandardMaterial color="#5a5346" roughness={0.95} wireframe />
      </instancedMesh>

      {boats.map((_, i) => (
        <group key={i} ref={(el) => (boatRefs.current[i] = el)}>
          <Dragger tint={DRAGGER_HULLS[i % DRAGGER_HULLS.length]} />
        </group>
      ))}
    </group>
  );
}

const DRAGGER_HULLS = ["#7a2f28", "#2f4a5a", "#3a5340", "#6a5320", "#5a5560", "#8a8378"];

// A New Bedford scallop dragger: raised bow, aft wheelhouse, tall mast with
// angled outrigger booms, and a stern gantry — the fleet's signature silhouette.
function Dragger({ tint }: { tint: string }) {
  return (
    <group>
      {/* hull + raised bow */}
      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[3, 1.5, 10]} />
        <meshStandardMaterial color={tint} roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh castShadow position={[0, 0.55, 4.4]}>
        <boxGeometry args={[2.7, 1.2, 1.8]} />
        <meshStandardMaterial color={tint} roughness={0.85} />
      </mesh>
      {/* deck */}
      <mesh position={[0, 0.78, -0.5]}>
        <boxGeometry args={[2.8, 0.12, 8.6]} />
        <meshStandardMaterial color="#4a4034" roughness={0.95} />
      </mesh>
      {/* wheelhouse aft */}
      <mesh castShadow position={[0, 1.7, -3.2]}>
        <boxGeometry args={[2.2, 1.8, 2.4]} />
        <meshStandardMaterial color="#ded8c8" roughness={0.7} />
      </mesh>
      <mesh position={[0, 2.75, -3.2]}>
        <boxGeometry args={[2.0, 0.4, 2.0]} />
        <meshStandardMaterial color="#b8b0a0" roughness={0.7} />
      </mesh>
      {/* tall mast forward of the wheelhouse */}
      <mesh position={[0, 3.6, -1.8]}>
        <cylinderGeometry args={[0.08, 0.1, 5.2, 6]} />
        <meshStandardMaterial color="#26241f" />
      </mesh>
      {/* outrigger booms angled down + out to each side (stowed) */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 1.6, 3.0, -1.0]} rotation={[0.5, 0, s * 0.95]}>
          <cylinderGeometry args={[0.06, 0.06, 7.5, 5]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
      ))}
      {/* stern gantry A-frame */}
      {[1, -1].map((s) => (
        <mesh key={`g${s}`} position={[s * 1.0, 1.7, -4.6]} rotation={[0, 0, s * 0.3]}>
          <cylinderGeometry args={[0.08, 0.08, 3.0, 5]} />
          <meshStandardMaterial color="#3a3a3a" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 3.1, -4.6]}>
        <boxGeometry args={[2.2, 0.16, 0.16]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.4} roughness={0.6} />
      </mesh>
    </group>
  );
}
