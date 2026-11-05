import * as THREE from "three";
// Original procedural material; illustrative painted siding, not a photo survey.
// Eight 20 cm courses per 1.6 m repeat, no plank meshes or external textures.
export function makeClapboardMaps() {
  const size = 128, color = new Uint8Array(size * size * 4), relief = new Uint8Array(color.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, course = y % 16;
    const grain = ((x * 13 + Math.floor(y / 2) * 7) % 11) - 5;
    const seam = course === 0 ? 36 : course === 1 ? 15 : 0;
    const tone = 239 + grain - seam;
    color.set([tone, tone - 3, tone - 9, 255], i);
    const height = course === 0 ? 40 : Math.round(120 + course * 5);
    relief.set([height, height, height, 255], i);
  }
  const albedo = new THREE.DataTexture(color, size, size), bump = new THREE.DataTexture(relief, size, size);
  albedo.colorSpace = THREE.SRGBColorSpace;
  for (const t of [albedo, bump]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  }
  return { albedo, bump };
}
export function makeClapboardBox(w: number, h: number, d: number) {
  const geometry = new THREE.BoxGeometry(w,h,d);
  const p = geometry.getAttribute("position"), n = geometry.getAttribute("normal"), uv = geometry.getAttribute("uv");
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(n.getY(i)) > 0.5) continue;
    uv.setXY(i, (Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i)) / 3.2, p.getY(i) / 1.6);
  }
  return geometry;
}
