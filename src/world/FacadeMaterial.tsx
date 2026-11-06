import { forwardRef, useMemo } from "react";
import * as THREE from "three";
import {
  FACADE_METALNESS,
  FACADE_RELIEF_SCALE,
  FACADE_WINDOW_GLOW,
} from "./facadeSurface";
import { makeFacadeMaps } from "./textures";

// Shared dielectric façade. `relief` adds the window/course normal. Leave it
// off for far merged chunks so three does not build a tangent attribute for
// an entire city cell. Flat shading is only for those distant chunks; the
// near shell needs the vertex normal so the relief stays in the wall plane.
export const FacadeMaterial = forwardRef<
  THREE.MeshStandardMaterial,
  { relief?: boolean; flatShading?: boolean }
>(function FacadeMaterial({ relief = true, flatShading = false }, ref) {
  const maps = useMemo(() => makeFacadeMaps(), []);
  const normalScale = useMemo(() => new THREE.Vector2(FACADE_RELIEF_SCALE, FACADE_RELIEF_SCALE), []);
  const reliefProps = relief ? { normalMap: maps.relief, normalScale } : {};
  return (
    <meshStandardMaterial
      ref={ref}
      vertexColors
      flatShading={flatShading}
      map={maps.albedo}
      emissiveMap={maps.emissive}
      roughnessMap={maps.roughness}
      {...reliefProps}
      emissive={FACADE_WINDOW_GLOW}
      emissiveIntensity={0}
      roughness={1}
      metalness={FACADE_METALNESS}
      envMapIntensity={1}
    />
  );
});
