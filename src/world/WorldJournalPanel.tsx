import { useState, useSyncExternalStore } from "react";
import { worldJournal } from "./worldJournal";

/** The recently-happened log makes persistent world state observable on iPhone. */
export function WorldJournalPanel() {
  const [open, setOpen] = useState(false);
  const events = useSyncExternalStore(worldJournal.subscribe, worldJournal.getSnapshot);
  return <>
    <button type="button" aria-label="Open world journal" aria-expanded={open} onClick={() => setOpen((v) => !v)}>Journal</button>
    {open && <section className="world-journal" aria-label="Recently happened in the Narrows">
      <header><strong>RECENTLY HAPPENED</strong><button type="button" aria-label="Close world journal" onClick={() => setOpen(false)}>×</button></header>
      <p>What the neighborhood remembers.</p>
      {events.length ? <ol>{[...events].reverse().map((e) => <li key={e.id}><small>Day {e.day} · {String(Math.floor(e.hour)).padStart(2, "0")}:{String(Math.floor((e.hour % 1) * 60)).padStart(2, "0")}</small><span>{e.text}</span></li>)}</ol> : <p>Nothing noteworthy yet. Walk around and see what happens.</p>}
    </section>}
  </>;
}
