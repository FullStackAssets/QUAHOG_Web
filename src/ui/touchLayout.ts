export type ControlLayout = Record<string, { left: number; top: number; size: number }>;
export type Insets = { left: number; right: number; top: number; bottom: number };
export function fitTouchLayout(layout: ControlLayout, width: number, height: number, insets: Insets = { left: 8, right: 8, top: 8, bottom: 8 }): ControlLayout {
  const fitted: ControlLayout = {};
  for (const [key, value] of Object.entries(layout)) {
    const maxSize = Math.max(1, Math.min(width - insets.left - insets.right, height - insets.top - insets.bottom));
    const size = Math.max(1, Math.min(Number.isFinite(value.size) ? value.size : 52, maxSize));
    const left = Math.max(insets.left, Math.min(Number.isFinite(value.left) ? value.left : insets.left, width - insets.right - size));
    const top = Math.max(insets.top, Math.min(Number.isFinite(value.top) ? value.top : insets.top, height - insets.bottom - size));
    fitted[key] = { left, top, size };
  }
  return fitted;
}
