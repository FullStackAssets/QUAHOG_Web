export const PLAYER_MAX_HEALTH = 100;
export const CONTACT_DAMAGE = 8;

export function applyContactDamage(health: number, hits = 1, damage = CONTACT_DAMAGE): number {
  const next = Math.max(0, health) - Math.max(0, hits) * damage;
  return Math.max(0, Math.min(PLAYER_MAX_HEALTH, next));
}

/** One damage tick per overlap, re-armed only after the actors separate. */
export function contactLatch(wasLatched: boolean, overlapping: boolean): { latched: boolean; hit: boolean } {
  if (!overlapping) return { latched: false, hit: false };
  if (wasLatched) return { latched: true, hit: false };
  return { latched: true, hit: true };
}
