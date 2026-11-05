import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { toWorld } from "../slice";
import type { Landmark } from "../slice";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { makeClapboardBox, makeClapboardMaps } from "./bethelSurface";
import { makeHeritagePavers, makeLawnMaterial, makeFlagTexture, makeFlagCloth } from "./heritageMaterials";
import { useGame } from "../store";

// Hand-detailed hero landmark: the Seamen's Bethel ("Whaleman's Chapel", 1832) on
// Johnny Cake Hill — a white New England clapboard chapel with a gable front,
// square belfry + spire, arched windows, and double doors over stone steps.
// Built procedurally from primitives; front facade faces +x (the approach).

const WHITE = "#f7f5ec";
const TRIM = "#f3f0e8";
const ROOF = "#2e2e33";
const STONE = "#8c8a84";
const DOOR = "#3a281a";
const GLASS = "#526771";

export function SeamensBethel({ landmark }: { landmark: Landmark }) {
  const snowy = useGame((s) => s.weather === "snow");
  const surface = useMemo(() => {
    const maps = makeClapboardMaps();
    return { maps, body: makeClapboardBox(18, 7, 12), tower: makeClapboardBox(3.4, 13, 3.4) };
  }, []);
  useEffect(() => () => { surface.body.dispose(); surface.tower.dispose(); surface.maps.albedo.dispose(); surface.maps.bump.dispose(); }, [surface]);
  const groundMaps = useMemo(() => ({pavers:makeHeritagePavers(), lawn:makeLawnMaterial(), flag:makeFlagTexture(), cloth:makeFlagCloth()}), []);
  useEffect(() => () => {
    groundMaps.pavers.albedo.dispose();groundMaps.pavers.bump.dispose();
    groundMaps.lawn.dispose();groundMaps.flag.dispose();groundMaps.cloth.dispose();
  }, [groundMaps]);
  const [wx, , wz] = toWorld(landmark.pos);

  // Gable roof as a triangular prism (ridge runs front→back along x).
  const roofGeom = useMemo(() => {
    const tri = new THREE.Shape();
    tri.moveTo(-6.3, 7.5);
    tri.lineTo(6.3, 7.5);
    tri.lineTo(0, 10.8);
    tri.closePath();
    const g = new THREE.ExtrudeGeometry(tri, { depth: 19, bevelEnabled: false });
    g.rotateY(Math.PI / 2); // extrude axis (z) -> world x
    g.translate(-9.5, 0, 0); // center along x
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <RigidBody name="landmark-seamens-bethel" type="fixed" colliders={false} position={[wx, 0, wz]}>
      {/* solid mass collider (body + projecting tower) */}
      <CuboidCollider args={[9.0, 4, 6.2]} position={[0, 4, 0]} />
      <CuboidCollider args={[1.8, 6.5, 1.8]} position={[8.4, 6.5, 0]} />

      {/* foundation */}
      <mesh position={[0, 0.25, 0]} receiveShadow castShadow>
        <boxGeometry args={[18.8, 0.5, 12.8]} />
        <meshStandardMaterial color={STONE} roughness={0.95} />
      </mesh>

      {/* main body */}
      <mesh name="bethel-main-clapboard" geometry={surface.body} position={[0, 4.0, 0]} castShadow receiveShadow>
        <meshStandardMaterial name="bethel-painted-clapboard" map={surface.maps.albedo} bumpMap={surface.maps.bump} bumpScale={0.025} roughness={0.88} />
      </mesh>

      <BethelTrim />

      {/* roof */}
      <mesh geometry={roofGeom} castShadow receiveShadow>
        <meshStandardMaterial color={snowy ? "#e0e6e5" : ROOF} roughness={0.9} flatShading />
      </mesh>

      {/* corner pilasters (white trim) */}
      {[
        [9, 6], [9, -6], [-9, 6], [-9, -6],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 4, z]} castShadow>
          <boxGeometry args={[0.5, 7.2, 0.5]} />
          <meshStandardMaterial color={TRIM} roughness={0.8} />
        </mesh>
      ))}

      {/* front entablature / cornice across the gable base (Greek-revival) */}
      <mesh position={[9.05, 7.55, 0]} castShadow>
        <boxGeometry args={[0.5, 0.55, 12.6]} />
        <meshStandardMaterial color={TRIM} roughness={0.8} />
      </mesh>

      {/* full square bell tower projecting from the front centre, rising through
          the roofline — the dominant feature of the real chapel */}
      <mesh name="bethel-tower-clapboard" geometry={surface.tower} position={[8.4, 9.5, 0]} castShadow receiveShadow>
        <meshStandardMaterial name="bethel-painted-clapboard" map={surface.maps.albedo} bumpMap={surface.maps.bump} bumpScale={0.025} roughness={0.88} />
      </mesh>
      {/* tower cornice cap */}
      <mesh position={[8.4, 13.4, 0]} castShadow>
        <boxGeometry args={[3.9, 0.4, 3.9]} />
        <meshStandardMaterial color={TRIM} roughness={0.8} />
      </mesh>
      {/* belfry louvered arched openings near the top of the tower */}
      {[
        [10.12, 0, 0],
        [6.68, 0, 0],
        [8.4, 1.72, Math.PI / 2],
        [8.4, -1.72, Math.PI / 2],
      ].map(([x, z, ry], i) => (
        <mesh key={i} position={[x, 11.8, z]} rotation-y={ry}>
          <boxGeometry args={[0.12, 2.2, 1.6]} />
          <meshStandardMaterial color="#20242c" roughness={0.6} />
        </mesh>
      ))}
      {/* octagonal spire + gilded finial */}
      <mesh position={[8.4, 15.6, 0]} castShadow>
        <coneGeometry args={[2.2, 4.2, 8]} />
        <meshStandardMaterial color={ROOF} roughness={0.7} flatShading />
      </mesh>
      <mesh position={[8.4, 18.0, 0]} castShadow>
        <sphereGeometry args={[0.24, 8, 8]} />
        <meshStandardMaterial color="#d8c270" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* double doors on the tower's front face */}
      <mesh position={[10.16, 2.0, 0]} castShadow>
        <boxGeometry args={[0.25, 3, 2.2]} />
        <meshStandardMaterial color={DOOR} roughness={0.7} />
      </mesh>
      <mesh position={[10.18, 3.6, 0]}>
        <boxGeometry args={[0.2, 0.55, 2.6]} />
        <meshStandardMaterial color={TRIM} roughness={0.8} />
      </mesh>

      {/* stone steps up to the tower entrance */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[10.7 + i * 0.5, 0.45 - i * 0.15, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.3, 3.2 + i * 0.6]} />
          <meshStandardMaterial color={STONE} roughness={0.95} />
        </mesh>
      ))}

      {/* side windows */}
      {[-4.5, 0, 4.5].map((x) => (
        <ArchWindow key={`r${x}`} position={[x, 3.6, 6.06]} axis="z" />
      ))}
      {[-4.5, 0, 4.5].map((x) => (
        <ArchWindow key={`l${x}`} position={[x, 3.6, -6.06]} axis="z" />
      ))}
      {/* front windows flanking the door */}
      <ArchWindow position={[9.06, 3.6, 3.2]} axis="x" />
      <ArchWindow position={[9.06, 3.6, -3.2]} axis="x" />

      {/* grass lawn the chapel sits on (set back from the street, like the photos) */}
      <mesh position={[0, 0.05, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[21, 16]} />
        <meshStandardMaterial map={snowy ? undefined : groundMaps.lawn} color={snowy ? "#dce4e7" : "#d1d4c8"} roughness={1} />
      </mesh>
      {/* flagpole + flag on the side lawn */}
      <group position={[4, 0, 7]}>
        <mesh position={[0, 3.5, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.08, 7, 6]} />
          <meshStandardMaterial color="#d8d8d0" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh geometry={groundMaps.cloth} position={[0, 6.24, 0]} castShadow>
          <meshStandardMaterial map={groundMaps.flag} side={THREE.DoubleSide} roughness={.94} />
        </mesh>
        <mesh position={[0, 7.04, 0]}>
          <sphereGeometry args={[.09, 10, 8]}/><meshStandardMaterial color="#e0c890" metalness={.7} roughness={.3}/>
        </mesh>
      </group>

      {/* brick walkway from the street up to the steps */}
      <mesh position={[13.8, 0.07, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[7.5, 2.6]} />
        <meshStandardMaterial map={groundMaps.pavers.albedo} bumpMap={groundMaps.pavers.bump} bumpScale={.055} color="#e5d3bb" roughness={0.86} />
      </mesh>
      {/* foundation shrubs flanking the front */}
      {[[-1, 4.6], [-1, -4.6], [3.5, 5.6], [3.5, -5.6]].map(([x, z], i) => (
        <group key={`shrub${i}`} position={[x, 0.45, z]}>
          <mesh castShadow receiveShadow position={[-.27,0,0]} scale={[.65,.56,.7]}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={snowy ? "#d6dcdd" : i%2 ? "#405e36" : "#456b3c"} roughness={1} />
          </mesh>
          <mesh castShadow receiveShadow position={[.38,.12,.06]} scale={[.55,.62,.61]}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={snowy ? "#e4e7e8" : "#536d41"} roughness={1} />
          </mesh>
        </group>
      ))}

      {/* name board over the door */}
      <Text
        position={[10.2, 5.4, 0]}
        rotation-y={Math.PI / 2}
        fontSize={0.46}
        color="#2a2118"
        anchorX="center"
        anchorY="middle"
        maxWidth={6}
        textAlign="center"
      >
        SEAMEN'S BETHEL
      </Text>
    </RigidBody>
  );
}

// Recessed arched sash, stone sill and projecting white casing.
function ArchWindow({ position, axis }: { position: [number, number, number]; axis: "x" | "z" }) {
  const ry = axis === "x" ? Math.PI / 2 : position[2] < 0 ? Math.PI : 0;
  const glass = useMemo(() => {
    const s = new THREE.Shape(); s.moveTo(-0.6, -1.3); s.lineTo(0.6, -1.3);
    s.lineTo(0.6, 0.9); s.absarc(0, 0.9, 0.6, 0, Math.PI, false); s.closePath();
    return new THREE.ShapeGeometry(s);
  }, []);
  useEffect(() => () => glass.dispose(), [glass]);
  return <group position={position} rotation-y={ry}>
    <mesh position={[0, 0, -0.04]}><boxGeometry args={[1.6, 3.1, 0.1]} /><meshStandardMaterial color={TRIM} roughness={0.85} /></mesh>
    <mesh geometry={glass} position={[0, 0, 0.06]}><meshStandardMaterial color={GLASS} roughness={0.32} metalness={0.15} /></mesh>
    {[-0.68, 0.68].map((x) => <mesh key={x} position={[x, -0.1, 0.13]}><boxGeometry args={[0.13, 2.7, 0.17]} /><meshStandardMaterial color={TRIM} roughness={0.85} /></mesh>)}
    <mesh position={[0, -1.44, 0.16]}><boxGeometry args={[1.72, 0.18, 0.4]} /><meshStandardMaterial color={STONE} roughness={0.95} /></mesh>
    <mesh position={[0, -0.12, 0.14]}><boxGeometry args={[0.05, 2.55, 0.08]} /><meshStandardMaterial color={TRIM} /></mesh>
    {[-0.55, 0.25, 0.86].map((y) => <mesh key={y} position={[0, y, 0.14]}><boxGeometry args={[1.2, 0.045, 0.08]} /><meshStandardMaterial color={TRIM} /></mesh>)}
  </group>;
}

function BethelTrim() {
  const geometry = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const box = (x: number, y: number, z: number, w: number, h: number, d: number) => {
      const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); parts.push(g);
    };
    for (const z of [-6.05, 6.05]) {
      box(0, 7.35, z, 18.4, 0.25, 0.3); box(0, 0.75, z, 18.2, 0.18, 0.2);
      for (const x of [-8.7, 8.7]) box(x, 4, z, 0.25, 6.8, 0.24);
    }
    for (const x of [6.64, 10.16]) for (const z of [-1.65, 1.65]) box(x, 10, z, 0.14, 6.6, 0.14);
    for (let y = 10.9; y < 12.7; y += 0.22) {
      for (const x of [6.62, 10.18]) box(x, y, 0, 0.15, 0.09, 1.7);
      for (const z of [-1.76, 1.76]) box(8.4, y, z, 1.7, 0.09, 0.15);
    }
    const merged = mergeGeometries(parts, false)!; parts.forEach((p) => p.dispose()); return merged;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} receiveShadow><meshStandardMaterial color={TRIM} roughness={0.86} /></mesh>;
}
