import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  EffectComposer, Bloom, Vignette, SMAA, LUT,
  HueSaturation, BrightnessContrast, N8AO,
} from "@react-three/postprocessing";
import * as THREE from "three";
import { shared } from "./../shared";
import { useGame } from "../store";
import { createGradingLut } from "./gradingLut";

// Cinematic post stack (§3 + Phase 3). ACES tone-map is on the renderer; here:
// bloom, chromatic aberration, film grain, a time-of-day colour grade (warm at
// dusk, cool + desaturated at night), TRD grading LUT (tint-free S-curve, so it
// composes with the time-of-day grade instead of fighting it), vignette, SMAA.
export function Effects() {
  const quality = useGame((s) => s.quality);
  const lut = useMemo(() => createGradingLut(), []);
  const hs = useRef<any>(null);     // eslint-disable-line @typescript-eslint/no-explicit-any
  const bc = useRef<any>(null);     // eslint-disable-line @typescript-eslint/no-explicit-any

  useFrame(() => {
    const day = shared.dayT;          // 1 noon .. 0 night
    const night = 1 - day;
    const dusk = THREE.MathUtils.clamp(1 - Math.abs(day - 0.18) * 4, 0, 1);
    if (hs.current) {
      hs.current.saturation = -0.06 - 0.1 * night;
      hs.current.hue = 0;
    }
    if (bc.current) {
      bc.current.brightness = -0.05 * night;
      bc.current.contrast = 0.035 + 0.025 * night;
    }
  });

  return (
    <EffectComposer multisampling={0}>
      {/* ambient occlusion — contact darkening where buildings/props meet the
          ground and in recesses; the biggest single "grounding"/realism cue.
          halfRes keeps it cheap enough for the streamed city. */}
      <N8AO halfRes aoRadius={1.2} distanceFalloff={1.0} intensity={0.7} />
      <Bloom intensity={quality === 2 ? 0.18 : 0.1} luminanceThreshold={1.1} luminanceSmoothing={0.2} mipmapBlur />
      <HueSaturation ref={hs} hue={0} saturation={0} />
      <BrightnessContrast ref={bc} brightness={0} contrast={0.06} />
      <LUT lut={lut} />
      <Vignette eskil={false} offset={0.35} darkness={0.24} />
      <SMAA />
    </EffectComposer>
  );
}
