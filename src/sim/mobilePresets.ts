/**
 * iPhone-oriented streaming / sim budgets by graphics quality tier.
 */

import type { Quality } from "../quality";

export interface StreamPreset {
  /** Soft resident byte cap for streamed tiles/assets. */
  maxResidentBytes: number;
  /** Concurrent tile fetches. */
  maxConcurrent: number;
  /** Interest radius in metres (building tiles use their own grid ring). */
  streamRadius: number;
  /** Max ms of streamer work per frame. */
  streamWorkMs: number;
  /** Nav repath cadence (seconds). */
  navHz: number;
}

export function streamPreset(q: Quality): StreamPreset {
  if (q === 0) {
    return {
      maxResidentBytes: 28 * 1024 * 1024,
      maxConcurrent: 1,
      streamRadius: 140,
      streamWorkMs: 2.5,
      navHz: 4,
    };
  }
  if (q === 1) {
    return {
      maxResidentBytes: 48 * 1024 * 1024,
      maxConcurrent: 2,
      streamRadius: 180,
      streamWorkMs: 4,
      navHz: 6,
    };
  }
  return {
    maxResidentBytes: 72 * 1024 * 1024,
    maxConcurrent: 3,
    streamRadius: 240,
    streamWorkMs: 6,
    navHz: 8,
  };
}
