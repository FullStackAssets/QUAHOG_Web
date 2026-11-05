// QUAHOG South Coast 2026: February blizzard story event.
// Reported storm totals: New Bedford 37 in; Fall River up to 41 in.
// The 52-inch number is a *dramatic snowdrift height* in the game,
// not a verified citywide snowfall measurement.
export const FEBRUARY_2026_BLIZZARD = {
  date: "2026-02-23",
  newBedfordMeasuredInches: 37,
  fallRiverReportedInches: 41,
  gameDriftInches: 52,
  missionTitle: "Blizzard of '26",
} as const;

export function isBlizzardMission(title: string, done: boolean): boolean {
  return !done && title === FEBRUARY_2026_BLIZZARD.missionTitle;
}

export function snowVehicleLimits(snowing: boolean, maxForward = 44, maxReverse = 16) {
  return snowing
    ? { forward: maxForward * 0.64, reverse: maxReverse * 0.62, steer: 0.72, throttleResponse: 0.62, handbrakeResponse: 0.65 }
    : { forward: maxForward, reverse: maxReverse, steer: 1, throttleResponse: 1, handbrakeResponse: 1 };
}

export function snowfallParticleCount(quality: 0 | 1 | 2): number {
  return quality === 0 ? 240 : quality === 1 ? 540 : 960;
}
