import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { reportModel } from "../debug/modelStatus";

// PackGLB — loads one Blender-pack GLB (Meshopt) into the game world.
// Same loader pattern as RevueltoCar: drei's useGLTF has no Meshopt decoder
// registered, so pack GLBs must come through a loader with setMeshoptDecoder.
// Manual load (no Suspense): renders nothing until the file arrives, so a
// slow or missing file leaves a gap instead of suspending the whole scene.
// Pack models are authored in metres, forward +Z, origin at ground-contact
// centre — the same convention as the procedural Vehicle — so they drop
// into existing layout groups unchanged.
export function PackGLB({ path }: { path: string }) {
  const [scene, setScene] = useState<THREE.Group | null>(null);

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    let alive = true;
    reportModel(path, "loading");
    loader.load(
      path,
      (gltf) => {
        reportModel(path, "loaded");
        if (alive) setScene(gltf.scene);
      },
      undefined,
      (err) => {
        reportModel(path, "failed", err instanceof Error ? err.message : String(err));
        console.error("[PackGLB] failed to load", path, err);
      },
    );
    return () => {
      alive = false;
    };
  }, [path]);

  const cloned = useMemo(() => (scene ? scene.clone(true) : null), [scene]);

  useEffect(() => {
    if (!cloned) return;
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) child.castShadow = true;
    });
  }, [cloned]);

  if (!cloned) return null;
  return <primitive object={cloned} />;
}
