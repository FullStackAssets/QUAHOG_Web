import { Component, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { FrameDriver } from "./mobile/FrameDriver";
import { mobileBudget } from "./mobile/profile";
import { Experience } from "./Experience";

// Keep one failing 3D component (e.g. a CDN asset that won't load) from blanking
// the entire game — render an empty scene instead of an unhandled throw. The HUD
// and menus (outside the Canvas) keep working.
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.error("[scene] component error:", e); }
  render() { return this.state.failed ? null : this.props.children; }
}
import { HUD } from "./HUD";
import { Minimap } from "./Minimap";
import { PauseMenu } from "./ui/PauseMenu";
import { CharacterMenu } from "./ui/CharacterMenu";
import { BigMap } from "./ui/BigMap";
import { TouchControls } from "./ui/TouchControls";
import { Toasts } from "./ui/Toasts";
import { DebugStats } from "./ui/DebugStats";
import { DebugOverlay } from "./debug/DebugOverlay";
import { DebugCapture } from "./debug/DebugCapture";
import { PerfProbe } from "./ui/PerfProbe";
import { StartMenu } from "./ui/StartMenu";
import { Radio } from "./audio/Radio";
import { installInput } from "./input";
import { useGame } from "./store";
import { shared } from "./shared";

// Build 002: quality presets now actually change GPU workload (study technique).
// Low locks DPR to 1; Medium allows up to 1.25; High up to 1.5.
const DPR_BY_QUALITY: ([number, number] | number)[] = [1, [1, 1.25], [1, 1.5]];

export default function App() {
  const [sliceName, setSliceName] = useState("loading…");
  const [progress, setProgress] = useState(0);
  const quality = useGame((s) => s.quality);
  const district = useGame((s) => s.district);

  // stable callbacks so the Experience loader effect doesn't re-run each render
  // Fall River integration (2026-11-03): onReady also fires the deferred
  // cross-district teleport. Experience remounts (key={district}) with fresh
  // physics bodies when the district switches, so the teleport must wait
  // for the new slice to load — teleporting earlier would target bodies
  // the remount is about to destroy. Same shape as BigMap.travel.
  const onReady = useCallback((s: { name: string }) => {
    setSliceName(s.name);
    const pending = useGame.getState().pendingFastTravel;
    if (pending) {
      useGame.getState().setPendingFastTravel(null);
      const pl = shared.player;
      if (pl) {
        pl.setEnabled(true);
        pl.setTranslation({ x: pending.x, y: 2, z: pending.z }, true);
        pl.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
      const car = shared.car;
      if (car) {
        car.setTranslation({ x: pending.x + 6, y: 1.4, z: pending.z + 4 }, true);
        car.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
      useGame.getState().setMode("foot");
    }
  }, []);
  const onProgress = useCallback((f: number) => setProgress(f), []);

  useEffect(() => {
    installInput();
  }, []);

  return (
    <>
      <Canvas
        shadows="soft"
        frameloop="never"
        camera={{ fov: 60, near: 0.3, far: 1000, position: [0, 10, 24] }}
        dpr={mobileBudget(quality).dpr}
        gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.98 }}
      >
        <FrameDriver />
        <DebugCapture />
        <PerfProbe />
        <Suspense fallback={null}>
          <SceneBoundary>
            {/* key={district}: a district switch remounts the whole scene
                (fresh slice, fresh physics bodies) — see onReady above. */}
            <Experience key={district} onReady={onReady} onProgress={onProgress} />
          </SceneBoundary>
        </Suspense>
      </Canvas>
      <HUD sliceName={sliceName} />
      <Minimap />
      <BigMap />
      <CharacterMenu />
      <PauseMenu />
      <TouchControls />
      <Toasts />
      <Radio />
      <DebugStats />
      <DebugOverlay />
      <StartMenu sliceName={sliceName} progress={progress} />
    </>
  );
}
