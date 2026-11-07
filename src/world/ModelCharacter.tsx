import { Component, useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useAnimations } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { reportAssetNotice, useAssetGeneration } from "../assets/assetNotices";
import { preloadMainGameModels, useMainGameGltf } from "../assets/mainGameGltf";
import { CHARACTER_MODEL_URL } from "../assets/modelRegistry";
import { Character } from "./Character";

// Rigged human (CesiumMan, © Cesium, CC-BY 4.0) for the main game player and
// pedestrians. Cloned per instance so each gets its own skeleton. Geometry stays
// shared with the cached GLTF — disposing it here would blank every other copy.
//
// TUNE these if the figure is the wrong size / facing the wrong way once you see
// it in the world.
const URL = CHARACTER_MODEL_URL;
const SCALE = 0.92; // model is ~2 units tall -> ~1.85 m
const FACE = 0; // yaw offset (radians) so it faces travel direction
const Y_OFF = 0; // lift/drop so feet sit on the ground

preloadMainGameModels();

type ModelProps = { moving?: () => boolean; tint?: string };

export function ModelCharacter({ moving, tint }: ModelProps) {
  const generation = useAssetGeneration();
  return (
    <group key={generation} rotation-y={FACE} position={[0, Y_OFF, 0]}>
      <ModelBoundary url={URL} moving={moving} tint={tint}>
        <RiggedModel moving={moving} tint={tint} />
      </ModelBoundary>
    </group>
  );
}

function RiggedModel({ moving, tint }: ModelProps) {
  const gltf = useMainGameGltf(URL);
  const scene = useMemo(() => skeletonClone(gltf.scene), [gltf.scene]);
  const { actions, names } = useAnimations(gltf.animations, scene);
  const action = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    const owned: THREE.Material[] = [];
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
        owned.push(m);
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
    const a = names.length ? actions[names[0]] : null;
    if (a) { a.reset().play(); action.current = a; }
    return () => {
      for (const material of owned) material.dispose();
    };
  }, [actions, names, scene, tint]);

  useFrame(() => {
    if (action.current) action.current.paused = moving ? !moving() : false;
  });

  return (
    <group scale={SCALE}>
      <primitive object={scene} />
    </group>
  );
}

// One model failure used to trip the scene-wide boundary and hide the whole
// world. The primitive character keeps the player and the crowd in place.
class ModelBoundary extends Component<ModelProps & { url: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[assets] model failed:", this.props.url, error);
    reportAssetNotice({ key: this.props.url, level: "error", message });
  }

  render() {
    if (this.state.failed) {
      return <Character shirt={this.props.tint} moving={this.props.moving} />;
    }
    return this.props.children;
  }
}
