import * as THREE from "three";

// Cross-component contact state for the photoreal play world. PlayerRig writes
// the player/car position each frame; TileNpcs registers its agents' bodies and
// applies any accumulated push (knockback) from contacts. Kept out of React
// state so per-frame writes don't re-render.

export interface Body {
  pos: THREE.Vector3; // content-space position (updated by owner each frame)
  push: THREE.Vector3; // accumulated knockback, applied + cleared by owner
  hit: number; // melee hits queued by the player (consumed by owner)
}

export const playState = {
  player: { pos: new THREE.Vector3(), driving: false },
  peds: [] as Body[],
  cars: [] as Body[],
  bump: 0, // set when the player's car hits an NPC car (PlayerRig reads + clears)
};

export function resetBodies() {
  playState.peds = [];
  playState.cars = [];
}
