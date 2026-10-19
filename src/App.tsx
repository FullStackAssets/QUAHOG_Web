import { Component, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
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
import { PerfProbe } from "./ui/PerfProbe";
import { StartMenu } from "./ui/StartMenu";
import { Radio } from "./audio/Radio";
import { installInput } from "./input";
import { useGame } from "./store";

// Build 002: quality presets now actually change GPU workload (study technique).
// Low locks DPR to 1; Medium allows up to 1.25; High up to 1.5.
const DPR_BY_QUALITY: ([number, number] | number)[] = [1, [1, 1.25], [1, 1.5]];

export default function App() {
  const [sliceName, setSliceName] = useState("loading…");
  const [progress, setProgress] = useState(0);
  const quality = useGame((s) => s.quality);

  // stable callbacks so the Experience loader effect doesn't re-run each render
  const onReady = useCallback((s: { name: string }) => setSliceName(s.name), []);
  const onProgress = useCallback((f: number) => setProgress(f), []);

  useEffect(() => {
    installInput();
  }, []);

  return (
    <>
      <Canvas
        shadows="soft"
        camera={{ fov: 60, near: 0.3, far: 1000, position: [0, 10, 24] }}
        dpr={DPR_BY_QUALITY[quality]}
        gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.98 }}
      >
        <PerfProbe />
        <Suspense fallback={null}>
          <SceneBoundary>
            <Experience onReady={onReady} onProgress={onProgress} />
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
      <StartMenu sliceName={sliceName} progress={progress} />
    </>
  );
}
