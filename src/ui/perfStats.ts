// Build 002: shared render-stats snapshot, written by <PerfProbe/> inside the
// Canvas once per ~500ms and read by <DebugStats/> outside it. Purely local
// telemetry for the "measured, not assumed" performance gate.
export const perfStats = {
  draws: 0,
  tris: 0,
};
