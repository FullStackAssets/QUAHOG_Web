import { useEffect, useState, useSyncExternalStore } from "react";

export type AssetNoticeLevel = "info" | "warn" | "error";

export type AssetNotice = {
  key: string;
  level: AssetNoticeLevel;
  message: string;
  count: number;
};

const notices = new Map<string, AssetNotice>();
let snapshot: AssetNotice[] = [];
const listeners = new Set<() => void>();

let generation = 0;
const generationListeners = new Set<() => void>();

export function reportAssetNotice(input: { key: string; level: AssetNoticeLevel; message: string }): void {
  const existing = notices.get(input.key);
  if (existing) {
    if (existing.message === input.message && existing.level === input.level) return;
    existing.message = input.message;
    existing.level = input.level;
    existing.count += 1;
  } else {
    notices.set(input.key, { key: input.key, level: input.level, message: input.message, count: 1 });
  }
  snapshot = Array.from(notices.values());
  listeners.forEach((listener) => listener());
}

export function clearAssetNotice(key: string): void {
  if (!notices.delete(key)) return;
  snapshot = Array.from(notices.values());
  listeners.forEach((listener) => listener());
}

export function clearAssetNotices(): void {
  if (notices.size === 0) return;
  notices.clear();
  snapshot = [];
  listeners.forEach((listener) => listener());
}

export function getAssetNoticeSnapshot(): AssetNotice[] {
  return snapshot;
}

export function subscribeAssetNotices(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAssetNotices(): AssetNotice[] {
  return useSyncExternalStore(subscribeAssetNotices, getAssetNoticeSnapshot, getAssetNoticeSnapshot);
}

export function assetGeneration(): number {
  return generation;
}

export function bumpAssetGeneration(): void {
  generation += 1;
  generationListeners.forEach((listener) => listener());
}

export function subscribeAssetGeneration(listener: () => void): () => void {
  generationListeners.add(listener);
  return () => generationListeners.delete(listener);
}

export function useAssetGeneration(): number {
  const [value, setValue] = useState(generation);
  useEffect(() => subscribeAssetGeneration(() => setValue(assetGeneration())), []);
  return value;
}
