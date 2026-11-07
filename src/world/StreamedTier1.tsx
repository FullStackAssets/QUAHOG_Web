import { useState } from "react";
import { useFrame } from "@react-three/fiber";
import { PackGLB } from "../actors/PackGLB";
import {
  nextStreamedIds,
  resolveStreamedTier1File,
  type Tier1StreamEntry,
} from "./tier1Stream";

// Distance-streamed Tier-1 mount (2026-11-07 real fix for the iPhone
// Safari jetsam crash). Replaces the old "mount every manifest entry at
// once" pattern in Tier1Models / NbTier1Models / DowntownTier1Models:
// each frame the camera position is checked against the manifest and
// only models within the load radius are mounted; models past the
// unload radius unmount, and PackGLB disposes their GPU memory on
// unmount. With frameloop="never" + FrameDriver, useFrame runs on every
// rendered frame (30 fps on mobile), so streaming tracks the player
// continuously while driving. `entries` must be a stable module-level
// manifest list (all three call sites pass one) — the useFrame closure
// captures it, and it never changes identity.
export function StreamedTier1({ entries }: { entries: readonly Tier1StreamEntry[] }) {
  const [mounted, setMounted] = useState<ReadonlySet<string>>(() => new Set<string>());
  useFrame((state) => {
    const { x, z } = state.camera.position;
    setMounted((prev) => nextStreamedIds(prev, entries, x, z));
  });
  return (
    <group>
      {entries
        .filter((e) => mounted.has(e.id))
        .map((e) => (
          <group key={e.id} position={e.position}>
            <PackGLB path={resolveStreamedTier1File(e.file)} />
          </group>
        ))}
    </group>
  );
}
