import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useGame } from "../store";
import { FrameClock, mobileBudget } from "./profile";

export function FrameDriver() {
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    const clock = new FrameClock();
    let raf = 0;
    let alive = true;
    const tick = (now: number) => {
      if (!alive || document.hidden) return;
      const g = useGame.getState();
      const fps = g.paused || !g.started ? 12 : mobileBudget(g.quality).fps;
      const time = clock.next(now, fps);
      if (time !== null) advance(time, true);
      raf = requestAnimationFrame(tick);
    };
    const visibility = () => {
      cancelAnimationFrame(raf); clock.suspend();
      if (!document.hidden) raf = requestAnimationFrame(tick);
    };
    document.addEventListener("visibilitychange", visibility);
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", visibility); };
  }, [advance]);
  return null;
}
