import { useFrame, useThree } from "@react-three/fiber";
import { shared } from "../shared";
import { useGame } from "../store";

export type WeatherTone = "clear" | "rain" | "fog" | "snow";

// Deliberately restrained dynamic exposure for legible nights and low-power
// mobile rendering. This is color grading, NOT realtime global illumination.
export function exposureFor(daylight: number, weather: WeatherTone): number {
  const day = Math.max(0, Math.min(1, daylight));
  const sunset = Math.max(0, 1 - Math.abs(day - 0.24) * 4);
  const base = 0.90 + 0.08 * day + 0.085 * sunset;
  const weatherShift = weather === "snow" ? -0.045 : weather === "rain" ? -0.025 : weather === "fog" ? -0.015 : 0;
  return Math.max(0.82, Math.min(1.10, base + weatherShift));
}

export function CinematicExposure() {
  const gl = useThree((s) => s.gl);
  useFrame((_, dt) => {
    const state = useGame.getState();
    if (state.paused) return;
    const target = exposureFor(shared.dayT, state.weather);
    gl.toneMappingExposure += (target - gl.toneMappingExposure) * (1 - Math.exp(-dt * 2));
  });
  return null;
}
