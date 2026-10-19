import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  EffectComposer, Bloom, Vignette, SMAA, ChromaticAberration, Noise,
  HueSaturation, BrightnessContrast, N8AO,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { shared } from "./../shared";

// Cinematic post stack (§3 + Phase 3). ACES tone-map is on the renderer; here:
// bloom, chromatic aberration, film grain, a time-of-day colour grade (warm at
// dusk, cool + desaturated at night), vignette, SMAA.
export function Effects() {
  const hs = useRef<any>(null);     // eslint-disable-line @typescript-eslint/no-explicit-any
  const bc = useRef<any>(null);     // eslint-disable-line @typescript-eslint/no-explicit-any

  useFrame(() => {
    const day = shared.dayT;          // 1 noon .. 0 night
    const night = 1 - day;
    const dusk = THREE.MathUtils.clamp(1 - Math.abs(day - 0.18) * 4, 0, 1);
    if (hs.current) {
      hs.current.saturation = -0.18 * night + 0.12 * dusk; // desat at night, pop at dusk
      hs.current.hue = 0.05 * dusk;                          // warm push at dusk
    }
    if (bc.current) {
      bc.current.brightness = -0.05 * night;
      bc.current.contrast = 0.1 + 0.05 * night;
    }
  });

  return (
    <EffectComposer multisampling={0}>
      {/* ambient occlusion — contact darkening where buildings/props meet the
          ground and in recesses; the biggest single "grounding"/realism cue.
          halfRes keeps it cheap enough for the streamed city. */}
      <N8AO halfRes aoRadius={2.2} distanceFalloff={1.0} intensity={2.2} />
      <Bloom intensity={0.42} luminanceThreshold={0.85} luminanceSmoothing={0.2} mipmapBlur />
      <ChromaticAberration offset={new THREE.Vector2(0.0008, 0.0008)} radialModulation modulationOffset={0.4} />
      <HueSaturation ref={hs} hue={0} saturation={0} />
      <BrightnessContrast ref={bc} brightness={0} contrast={0.06} />
      <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.16} />
      <Vignette eskil={false} offset={0.28} darkness={0.68} />
      <SMAA />
    </EffectComposer>
  );
}
