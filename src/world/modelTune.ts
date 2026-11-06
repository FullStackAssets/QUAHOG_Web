// CesiumMan is about 2 units tall. These are the checked-in tune values.
// They are intentionally unchanged: there is no device preview in this pass,
// so SCALE / FACE / Y_OFF were not "adjusted until it looked right".

export const MODEL_SOURCE_HEIGHT = 2;
export const MODEL_SCALE = 0.92;
export const MODEL_FACE = 0;
export const MODEL_Y_OFF = 0;

export function modelHeightMeters(scale = MODEL_SCALE, source = MODEL_SOURCE_HEIGHT): number {
  return scale * source;
}

export function modelTuneSane(
  scale = MODEL_SCALE,
  face = MODEL_FACE,
  yOff = MODEL_Y_OFF,
): boolean {
  return scale > 0.5 && scale < 1.5 && Math.abs(face) <= Math.PI && Math.abs(yOff) < 0.5;
}
