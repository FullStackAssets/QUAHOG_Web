/**
 * §3.2 Star-tier escalation table — spawn counts and response flags.
 * Independent Mount Hope design (not a port of any proprietary wanted matrix).
 */

export interface HeatTier {
  stars: number;
  /** Active road units to maintain. */
  cops: number;
  roadblocks: boolean;
  helicopter: boolean;
  pit: boolean;
  /** When true, natural heat decay is frozen. */
  noDecay: boolean;
  label: string;
}

export const HEAT_TIERS: readonly HeatTier[] = [
  { stars: 0, cops: 0, roadblocks: false, helicopter: false, pit: false, noDecay: false, label: "Clear" },
  { stars: 1, cops: 0, roadblocks: false, helicopter: false, pit: false, noDecay: false, label: "Suspicious" },
  { stars: 2, cops: 1, roadblocks: false, helicopter: false, pit: false, noDecay: false, label: "Wanted" },
  { stars: 3, cops: 2, roadblocks: false, helicopter: true, pit: false, noDecay: false, label: "Chase" },
  { stars: 4, cops: 3, roadblocks: true, helicopter: true, pit: true, noDecay: false, label: "Manhunt" },
  { stars: 5, cops: 3, roadblocks: true, helicopter: true, pit: true, noDecay: true, label: "APB" },
];

export function heatTier(police: number): HeatTier {
  const s = Math.max(0, Math.min(5, Math.floor(police)));
  return HEAT_TIERS[s];
}

/** Desired active chase units for the current police heat. */
export function desiredCops(police: number, maxCops = 3): number {
  return Math.min(maxCops, heatTier(police).cops);
}
