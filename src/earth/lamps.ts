export function lampIntensity(dayT: number, braking: boolean, forceOn = false): { head: number; tail: number } {
  const night = forceOn ? 1 : 1 - Math.min(1, Math.max(0, dayT));
  return {
    head: 0.3 + night * 1.6,
    tail: 0.3 + night * 0.9 + (braking ? 2.2 : 0),
  };
}
