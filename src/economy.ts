import { create } from "zustand";

// Property / business empire (§15 AcquisitionEngine + RevenueManager, §17 economy).
// Buy fronts around the city; owned fronts trickle income into the wallet.

export interface Business {
  id: string;
  name: string;
  blurb: string;
  pos: [number, number, number];
  cost: number;
  perDay: number; // income per in-game day
}

// Original SouthCoast fronts (parody flavour, original names).
export const BUSINESSES: Business[] = [
  { id: "anvil", name: "The Anvil Garage", blurb: "chop shop", pos: [-320, 0, 60], cost: 500, perDay: 220 },
  { id: "quohog", name: "Quohog Republic", blurb: "dockside bar", pos: [-240, 0, 122], cost: 800, perDay: 320 },
  { id: "linq", name: "Linguiça Linq", blurb: "all-night diner", pos: [-300, 0, 92], cost: 650, perDay: 260 },
  { id: "marealta", name: "Maré Alta Records", blurb: "record shop", pos: [-262, 0, 60], cost: 700, perDay: 280 },
  { id: "whalingcab", name: "Whaling City Cab", blurb: "taxi depot", pos: [-220, 0, 176], cost: 900, perDay: 360 },
  // out on Sconticut Neck toward Long Island — 56 Goulart Memorial Drive
  { id: "longisland", name: "Off the Hook Bar and Grill", blurb: "Long Island waterfront bar & marina", pos: [6092, 0, 4485], cost: 1800, perDay: 600 },
  { id: "dartmall", name: "Dartmouth Mall", blurb: "Route 6 retail hub", pos: [-3921, 0, 398], cost: 2500, perDay: 850 },
];

// Where the pilotable boat is moored (just off the Long Island marina).
export const BOAT_SPAWN: [number, number, number] = [6130, 0.6, 4520];

const KEY = "mounthope.economy.v1";

interface EconomyState {
  owned: Record<string, true>;
  near: Business | null;
  buy: (b: Business) => void; // assumes affordability checked by caller
  setNear: (b: Business | null) => void;
  incomePerSec: (daySeconds: number) => number;
  save: () => void;
  load: () => void;
}

export const useEconomy = create<EconomyState>((set, get) => ({
  owned: {},
  near: null,
  buy: (b) => set((s) => ({ owned: { ...s.owned, [b.id]: true } })),
  setNear: (b) => set((s) => (s.near?.id === b?.id ? s : { near: b })),
  incomePerSec: (daySeconds) => {
    // A zero/negative/NaN day length would divide to Infinity/NaN and corrupt
    // the wallet on the next income tick — guard it.
    if (!Number.isFinite(daySeconds) || daySeconds <= 0) return 0;
    const { owned } = get();
    let perDay = 0;
    for (const b of BUSINESSES) if (owned[b.id]) perDay += b.perDay;
    return perDay / daySeconds;
  },
  save: () => { try { localStorage.setItem(KEY, JSON.stringify(get().owned)); } catch { /* ignore */ } },
  load: () => {
    try {
      const r = localStorage.getItem(KEY);
      if (!r) return;
      const parsed = JSON.parse(r);
      // Only accept a plain object map; ignore arrays/strings/null from a
      // corrupt save so `owned[b.id]` lookups can't throw or misbehave.
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
      // Keep only ids that still map to a real business and truthy values.
      const owned: Record<string, true> = {};
      for (const b of BUSINESSES) if ((parsed as Record<string, unknown>)[b.id]) owned[b.id] = true;
      set({ owned });
    } catch { /* ignore malformed save */ }
  },
}));

// --- RevenueManager: margin-leak / boom events (§15/§17) ---------------------
// Beyond the steady passive trickle, owned fronts occasionally throw a one-off
// windfall or loss — a feast-week rush, a skimmed register, a "protection"
// envelope coming due. Flavour only; amounts scale to a fraction of the front's
// daily take so they matter without swinging the economy.
export interface RevenueEvent { good: boolean; text: string; amount: number }

const BOOM = [
  "{name}: feast-week rush — takings up {amt}",
  "{name}: a tour bus emptied out front — +{amt}",
  "{name}: the fleet came in heavy, big spenders — +{amt}",
  "{name}: cash-only Friday, clean books — +{amt}",
  "{name}: cruise-night crowd packed it — +{amt}",
];
const LEAK = [
  "{name}: health inspector 'visit' — -{amt}",
  "{name}: walk-in freezer died — -{amt}",
  "{name}: register came up short — -{amt}",
  "{name}: a pipe let go out back — -{amt}",
  "{name}: protection envelope came due — -{amt}",
];

export function ownedBusinesses(): Business[] {
  const { owned } = useEconomy.getState();
  return BUSINESSES.filter((b) => owned[b.id]);
}

/** Roll one revenue event for a random owned front, or null if you own none. */
export function rollRevenueEvent(rng: () => number = Math.random): RevenueEvent | null {
  const owned = ownedBusinesses();
  if (!owned.length) return null;
  const b = owned[Math.floor(rng() * owned.length)];
  const good = rng() < 0.55; // lean slightly toward booms
  const amount = Math.round(b.perDay * (0.4 + rng() * 0.8));
  const pool = good ? BOOM : LEAK;
  const text = pool[Math.floor(rng() * pool.length)]
    .replace("{name}", b.name)
    .replace("{amt}", `$${amount}`);
  return { good, text, amount: good ? amount : -amount };
}
