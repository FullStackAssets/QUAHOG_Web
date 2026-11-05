import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { type RefObject } from "react";
import type { RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";

// One translucent radial contact patch grounds the hero car even when the
// mobile Low preset skips shadow-map passes. Never collides with anything.
// Playtest fix (2026-11-02, E-03): y=0.15 sits above roads (0.06–0.08),
// crosswalks (0.085) and sidewalks (0.14), so the blob is never buried
// under a surface the car straddles — the old 0.09 height is what made it
// read as a "detached" shadow.
export function CarGrounding({ body }: {body: RefObject<RapierRigidBody>}) {
  const mesh=useRef<THREE.Mesh>(null);
  const map=useMemo(()=>{
    const c=document.createElement("canvas");c.width=c.height=128;
    const x=c.getContext("2d")!;
    const grad=x.createRadialGradient(64,64,10,64,64,63);
    grad.addColorStop(0,"rgba(13,18,23,.40)");grad.addColorStop(.55,"rgba(13,18,23,.22)");grad.addColorStop(1,"rgba(13,18,23,0)");
    x.fillStyle=grad;x.fillRect(0,0,128,128);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
  },[]);
  useEffect(()=>()=>map.dispose(),[map]);
  useFrame(()=>{
    const m=mesh.current,b=body.current;
    if(!m)return;
    m.visible=Boolean(b);
    if(!b)return;
    const p=b.translation();m.position.set(p.x,.15,p.z);
    // Do not paint a road shadow under a vehicle midair or over the water.
    const mat = m.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, Math.min(1, (3.4 - p.y) / 2.2));
    m.visible = mat.opacity > 0.03;
    m.rotation.set(-Math.PI/2,0,0); // uniform blob; orientation not required
  });
  return <mesh ref={mesh} rotation-x={-Math.PI/2} renderOrder={5}>
    <planeGeometry args={[3.15,5.5]}/>
    <meshBasicMaterial map={map} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-3}/>
  </mesh>;
}
