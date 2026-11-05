import { describe, expect, it } from "vitest";
import franklinRaw from "../../public/models/franklin_animated.glb?raw";

// Franklin player-character swap (bulk job 2026-11-03, Nic's production
// override ~06:14 EST). Same JSON-chunk recovery pattern as
// tier1Models.test.ts: only the JSON chunk is parsed, so the ?raw UTF-8
// read of the BIN bytes cannot corrupt it. This pins the FILE the game
// loads (ModelCharacter URL) — gait logic itself (Idle/Walk/Run named
// selection + crossfade) lives in ModelCharacter and is exercised at
// runtime, not here.
describe("franklin player character", () => {
  it("ships the animated Franklin GLB with exactly the Idle/Walk/Run clips", () => {
    const raw = franklinRaw as unknown as string;
    const start = raw.indexOf("{");
    expect(start).toBeGreaterThanOrEqual(0);
    let depth = 0;
    let end = -1;
    for (let i = start; i < raw.length; i++) {
      if (raw[i] === "{") depth++;
      else if (raw[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    expect(end).toBeGreaterThan(start);
    const j = JSON.parse(raw.slice(start, end)) as {
      animations: { name: string }[];
      skins: { joints: number[] }[];
      nodes: { name?: string; scale?: number[] }[];
    };
    // Case-sensitive names: ModelCharacter selects on exactly these.
    expect(j.animations.map((a) => a.name).sort()).toEqual(["Idle", "Run", "Walk"]);
    expect(j.skins).toHaveLength(1);
    expect(j.skins[0].joints).toHaveLength(65);
    const armature = j.nodes.find((n) => n.name === "Armature");
    expect(armature).toBeTruthy();
    // Armature scale already yields ~1.85 m, so ModelCharacter SCALE is 1.0.
    expect(armature!.scale![0]).toBeCloseTo(0.009969, 5);
  });
});
