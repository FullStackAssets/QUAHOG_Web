import { useEffect, useRef, useState } from "react";
import { isDown, moveAxis } from "../input";
import { advanceIdle, tileActivityFor, type TileActivity } from "./frameLoop";

function playInputHeld(): boolean {
  const axis = moveAxis();
  if (axis.x !== 0 || axis.y !== 0) return true;
  return isDown("ShiftLeft") || isDown("ShiftRight") || isDown("Space") || isDown("KeyE") || isDown("KeyF");
}

const ALWAYS: TileActivity = { loop: "always", tilesEnabled: true };

/** Pause the photoreal frame loop when the tab is hidden or the player has gone idle. */
export function useTileActivity(pauseWhenIdle: boolean): TileActivity {
  const pauseRef = useRef(pauseWhenIdle);
  pauseRef.current = pauseWhenIdle;
  const [activity, setActivity] = useState<TileActivity>(ALWAYS);

  useEffect(() => {
    let idle = 0;
    let last = performance.now();
    let prev = "";
    const publish = (hidden: boolean) => {
      const next = tileActivityFor({ hidden, idleMs: idle, pauseWhenIdle: pauseRef.current });
      const key = `${next.loop}:${next.tilesEnabled}`;
      if (key === prev) return;
      prev = key;
      setActivity(next);
    };
    const wake = () => {
      idle = 0;
      last = performance.now();
      publish(typeof document !== "undefined" && document.hidden);
    };
    const onVis = () => wake();
    window.addEventListener("keydown", wake);
    window.addEventListener("keyup", wake);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("wheel", wake, { passive: true });
    window.addEventListener("touchstart", wake, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      const hidden = document.hidden;
      idle = hidden ? 0 : advanceIdle(idle, dt, playInputHeld());
      publish(hidden);
    }, 200);
    publish(document.hidden);
    return () => {
      window.removeEventListener("keydown", wake);
      window.removeEventListener("keyup", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("wheel", wake);
      window.removeEventListener("touchstart", wake);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
    };
  }, []);

  return activity;
}
