import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

// Franklin (player character, bulk job 2026-11-03 — production override by
// Nic 2026-11-03 ~06:14 EST, superseding the 2026-11-02 staging-only policy
// for Franklin specifically). Replaces CesiumMan as the player model;
// pedestrians keep their separate RiggedPedestrian paths (untouched).
// File: public/models/franklin_animated.glb (2,687,296 B, 1 skin /
// 65 joints, Armature node 72 scale 0.009969, animations Idle / Walk / Run
// — case-sensitive names, verified from the file 2026-11-03).
//
// TUNE these if the figure is the wrong size / facing the wrong way once
// you see it on the tiles — feet/facing are MUST-VERIFY items on staging:
// FACE/Y_OFF are kept at 0/0 because no JSON-only measurement clearly
// showed an offset (the authoring height ~1.85 m vs ~1.94 m from a raw-JSON
// joint traversal disagree, so neither is claimed exact here).
const URL = "/models/franklin_animated.glb";
const SCALE = 1.0; // NOT 0.92: Franklin's Armature scale already yields ~1.85 m; 0.92 would shrink him to ~1.70 m
const FACE = 0; // yaw offset (radians) so it faces travel direction
const Y_OFF = 0; // lift/drop so feet sit on the ground

useGLTF.preload(URL);

export function ModelCharacter({ moving, sprinting, tint }: { moving?: () => boolean; sprinting?: () => boolean; tint?: string }) {
  const gltf = useGLTF(URL);
  const scene = useMemo(() => skeletonClone(gltf.scene), [gltf.scene]);
  const { actions, names } = useAnimations(gltf.animations, scene);
  const current = useRef<{ name: string; action: THREE.AnimationAction } | null>(null);

  useEffect(() => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const src = mesh.material as THREE.Material;
      let m = (Array.isArray(src) ? src[0] : src) as THREE.MeshStandardMaterial;
      // NOTE (Franklin): the old CesiumMan path cloned the material and
      // multiplied its colour by 0.72 when a tint was set. That must NOT
      // run on Franklin — it would darken all 7 textured Franklin
      // materials even at the default white tint. Outfit swatches simply
      // do not affect Franklin in this build (known limitation, pending a
      // proper outfit decision). The clone is kept so the sheen-kill below
      // never mutates a shared source material.
      if (tint) {
        m = m.clone();
        mesh.material = m;
      }
      // Kill the over-bright sheen either way: no metalness/emissive, fully rough,
      // low env reflection. Characters were reading blown-out and haloed by bloom.
      m.metalness = 0;
      m.roughness = Math.max(m.roughness ?? 0.9, 0.9);
      if (m.emissive) { m.emissive.setRGB(0, 0, 0); m.emissiveIntensity = 0; }
      m.envMapIntensity = 0.5;
    });
    // Start on Idle; the frame loop crossfades to Walk/Run as gait changes.
    const first = names.includes("Idle") ? actions["Idle"] : (names.length ? actions[names[0]] : null);
    if (first) { first.reset().play(); current.current = { name: names.includes("Idle") ? "Idle" : names[0], action: first }; }
    return () => { current.current = null; };
  }, [actions, names, scene, tint]);

  useFrame(() => {
    // Named-clip gait selection (REQUIRED — with code unmodified, names[0]
    // = Idle would play Idle while walking): still → Idle, moving → Walk,
    // sprinting → Run (sprint only counts while actually moving, so a stale
    // sprint flag while paused/driving can't play Run under a still body).
    // Crossfade 0.2 s on change; unknown/missing clips fall back to
    // whatever is currently playing.
    const isMoving = moving?.() ?? false;
    const want = sprinting?.() && isMoving ? "Run" : (isMoving ? "Walk" : "Idle");
    if (current.current?.name === want) return;
    const next = actions[want];
    if (!next) return;
    const prev = current.current?.action;
    if (prev) prev.fadeOut(0.2);
    next.reset().fadeIn(0.2).play();
    current.current = { name: want, action: next };
  });

  return (
    <group rotation-y={FACE} position={[0, Y_OFF, 0]} scale={SCALE}>
      <primitive object={scene} />
    </group>
  );
}
