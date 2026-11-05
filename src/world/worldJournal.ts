import { getItem, removeItem, setItem } from "../storage";
import { addWorldEvent, decodeWorldLedger, emptyWorldLedger } from "./worldContinuity";
import type { WorldEvent, WorldLedger } from "./worldContinuity";

export const JOURNAL_KEY = "mounthope.world.events.v1";
const BACKUP_KEY = `${JOURNAL_KEY}.previous`;

/** One in-memory snapshot shared by React + game loops. Persist only on events. */
let ledger: WorldLedger = emptyWorldLedger();
let snapshot: readonly WorldEvent[] = ledger.events;
const listeners = new Set<() => void>();
const publish = () => { snapshot = ledger.events; for (const listener of listeners) listener(); };

export const worldJournal = {
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getSnapshot: () => snapshot,
  load: () => {
    ledger = decodeWorldLedger(getItem(JOURNAL_KEY)) ??
      decodeWorldLedger(getItem(BACKUP_KEY)) ?? emptyWorldLedger();
    publish();
  },
  record: (event: Omit<WorldEvent, "id">) => {
    const next = addWorldEvent(ledger, event);
    if (next === ledger) return;
    const raw = getItem(JOURNAL_KEY);
    if (raw && decodeWorldLedger(raw)) setItem(BACKUP_KEY, raw);
    ledger = next;
    setItem(JOURNAL_KEY, JSON.stringify(ledger));
    publish();
  },
  reset: () => { ledger = emptyWorldLedger(); removeItem(JOURNAL_KEY, BACKUP_KEY); publish(); },
};
