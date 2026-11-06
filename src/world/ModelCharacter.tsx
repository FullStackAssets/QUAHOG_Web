import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { clipTimeScale, pickClip, type Gait } from "../actors/gait";
import { MODEL_FACE, MODEL_SCALE, MODEL_Y_OFF } from "./modelTune";

// Rigged human (CesiumMan, © Cesium, CC-BY 4.0) for the stylized world. Cloned
// per instance so the player and every pedestrian get their own skeleton.
// The photoreal tiles view does not use this: skinning breaks at earth-centered
// coordinates. SCALE / FACE / Y_OFF live in modelTune.ts and were not changed
// without a device look.
const URL = "/models/CesiumMan.glb";

useGLTF.preload(URL);

export function ModelCharacter({ moving, pace, tint }: { moving?: () => boolean; pace?: () => Gait; tint?: string }) {
  const gltf = useGLTF(URL);
  const scene = useMemo(() => skeletonClone(gltf.scene), [gltf.scene]);
  const { actions, names } = useAnimations(gltf.animations, scene);
  const action = useRef<THREE.AnimationAction | null>(null);
  const clipName = useRef<string | null>(null);

  useEffect(() => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const src = mesh.material as THREE.Material;
      let m = (Array.isArray(src) ? src[0] : src) as THREE.MeshStandardMaterial;
      // tint a private material clone so the player's outfit colour doesn't
      // bleed onto pedestrians sharing the source GLB material.
      if (tint) {
        m = m.clone();
        // absolute (set→scale, not relative multiply) so repeat effect runs don't
        // compound; 0.72 keeps the light jumpsuit — esp. the default white tint —
        // from clipping to a glowing white blob under the noon sun + bloom.
        if (m.color) m.color.set(tint).multiplyScalar(0.72);
        mesh.material = m;
      }
      // Kill the over-bright sheen either way: no metalness/emissive, fully rough,
      // low env reflection. Characters were reading blown-out and haloed by bloom.
      m.metalness = 0;
      m.roughness = Math.max(m.roughness ?? 0.9, 0.9);
      if (m.emissive) { m.emissive.setRGB(0, 0, 0); m.emissiveIntensity = 0; }
      m.envMapIntensity = 0.5;
    });
  }, [scene, tint]);

  useFrame(() => {
    const gait: Gait = pace ? pace() : moving?.() ? "walk" : "idle";
    const name = pickClip(names, gait);
    if (!name) return;
    const next = actions[name];
    if (!next) return;
    if (clipName.current !== name) {
      action.current?.fadeOut(0.2);
      next.reset().fadeIn(0.2).play();
      action.current = next;
      clipName.current = name;
    }
    const scale = clipTimeScale(gait);
    next.paused = scale === 0;
    if (scale > 0) next.timeScale = scale;
  });

  return (
    <group rotation-y={MODEL_FACE} position={[0, MODEL_Y_OFF, 0]} scale={MODEL_SCALE}>
      <primitive object={scene} />
    </group>
  );
}
