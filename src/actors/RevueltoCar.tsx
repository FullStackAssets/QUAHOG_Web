import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { WheelRig } from "./WheelRig";
import { usePackGLB } from "./packLoader";
import { reportModel } from "../debug/modelStatus";

// Nic's car (2026-11-02): the red Revuelto game-ified from BlenderKit,
// mounted as the player's car. Loaded with its own GLTFLoader because the
// game's ProductionGLB loader is a separate instance — drei's useGLTF has
// no Meshopt decoder registered, so a Meshopt GLB must come through a
// loader with setMeshoptDecoder, exactly as ProductionGLB does.
// The GLB's own origin is at ground-contact centre and its forward is +Z,
// matching Car's visual group (offset [0, -0.6, 0], local +Z forward).
const MODEL_URL = "/assets/cars/revuelto_game.glb?v=wheelfix-20261103";
// ^ Cache-bust (2026-11-03 wheels fix): the GLB URL is otherwise unhashed,
// so iPhone Safari would keep serving the pre-fix file with floating trim
// tubes. Bump the query value whenever the GLB changes; keep in sync with
// REVUELTO_URL in debug/DebugOverlay.tsx (exact-match lookup).
// Clean-wheel radii measured from the rebuilt wheels (2026-11-03): front
// 0.372 m, rear 0.401 m, mean 0.387. One WheelRig radius serves all four.
const WHEEL_RADIUS_M = 0.39;

// Stream A (2026-11-03): the old `fallback` prop (a procedural Mustang
// supplied by <Car>) is gone. On load failure this component retries the
// real Revuelto GLB, then renders a real pack GLB as the last resort —
// never a procedural mesh, and never an invisible player car.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 400;
/** Last-resort player-car visual: a real P006 sports coupe GLB. Only
 *  reached when the Revuelto GLB fails 3 times; its wheels spin via
 *  WheelRig's default shared.carSpeed source. Paint is baked. */
const PLACEHOLDER_PACK = "/packs/pack006/sports_coupe.glb";
const PLACEHOLDER_WHEEL_R = 0.33;

function RevueltoPlaceholder() {
  const { scene } = usePackGLB(PLACEHOLDER_PACK);
  if (!scene) return null;
  return (
    <>
      <primitive object={scene} />
      <WheelRig scene={scene} wheelR={PLACEHOLDER_WHEEL_R} />
    </>
  );
}

export function RevueltoCar() {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    reportModel(MODEL_URL, "loading");
    loader.load(
      MODEL_URL,
      (gltf) => {
        reportModel(MODEL_URL, "loaded");
        if (alive) setScene(gltf.scene);
      },
      undefined,
      (err) => {
        // Report every failure to the debug model registry (a silent null
        // is how the car "did not appear" went undiagnosed before), then
        // retry, then degrade to the pack-GLB placeholder — never to a
        // procedural mesh and never to invisibility.
        reportModel(MODEL_URL, "failed", err instanceof Error ? err.message : String(err));
        console.error("[RevueltoCar] failed to load", MODEL_URL, err);
        if (!alive) return;
        if (attempt + 1 < MAX_ATTEMPTS) {
          timer = setTimeout(() => { if (alive) setAttempt((a) => a + 1); }, RETRY_DELAY_MS);
        } else {
          setFailed(true);
        }
      },
    );
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [attempt]);

  const cloned = useMemo(() => (scene ? scene.clone(true) : null), [scene]);

  useEffect(() => {
    if (!cloned) return;
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) child.castShadow = true;
    });
  }, [cloned]);

  if (failed) return <RevueltoPlaceholder />;
  if (!cloned) return null;
  return (
    <>
      <primitive object={cloned} />
      <WheelRig scene={cloned} wheelR={WHEEL_RADIUS_M} />
    </>
  );
}
