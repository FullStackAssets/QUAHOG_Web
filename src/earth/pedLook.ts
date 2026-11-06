// Distinct rigid pedestrians. These are palette / proportion variants of the
// same humanoid, not separate scanned people. Indexing is deterministic so a
// reload doesn't reshuffle the crowd and tests can pin the variety.

export interface PedLook {
  shirt: string;
  pants: string;
  skin: string;
  hair: string;
  scale: number;
  build: number;
  hat: boolean;
}

const SHIRTS = ["#c0563f", "#3f6cc0", "#4a8c52", "#b8a23a", "#7a4a8c", "#c87a3f"];
const PANTS = ["#2c2f3a", "#3a3326", "#23344f", "#4a4a4a", "#5a3a2a", "#1f2a1f"];
const SKINS = ["#caa07a", "#e0b48c", "#a87a52", "#8a5a36", "#d8a87a", "#6a4226"];
const HAIRS = ["#2a2018", "#4a3422", "#1a1a1a", "#6a5a3a", "#8a8a8a", "#bcae8a"];

export function pedLook(index: number): PedLook {
  const i = Math.abs(index) | 0;
  return {
    shirt: SHIRTS[i % SHIRTS.length],
    pants: PANTS[(i * 3 + 1) % PANTS.length],
    skin: SKINS[(i * 5 + 2) % SKINS.length],
    hair: HAIRS[(i * 7 + 3) % HAIRS.length],
    scale: 0.92 + (i % 5) * 0.035,
    build: 0.9 + (i % 4) * 0.05,
    hat: i % 3 === 0,
  };
}
