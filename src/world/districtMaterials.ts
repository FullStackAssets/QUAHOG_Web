import * as THREE from "three";
import type { FacadeKind } from "./districtStyle";

// Original, deterministic procedural art. No downloaded photography, CDN, or
// extra texture per building. Three shared 256px facade sets for the district.
const cache = new Map<string, THREE.CanvasTexture>();
function texture(key: string, paint: (c: CanvasRenderingContext2D) => void) {
  if (cache.has(key)) return cache.get(key)!;
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
  paint(canvas.getContext("2d")!);
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  cache.set(key, t); return t;
}

export function claddingTexture(kind: FacadeKind) {
  return texture(`surface:${kind}`, (c) => {
    c.fillStyle = "#e4e1da"; c.fillRect(0, 0, 256, 256);
    if (kind === "clapboard") {
      for (let y = 0; y < 256; y += 12) {
        c.fillStyle = "#b7b9b5"; c.fillRect(0, y + 10, 256, 2);
        c.fillStyle = "#faf9f3"; c.fillRect(0, y, 256, 1);
      }
    } else {
      const height = kind === "brick" ? 9 : 42, width = kind === "brick" ? 28 : 94;
      c.fillStyle = kind === "brick" ? "#8d8677" : "#92958f"; c.fillRect(0, 0, 256, 256);
      for (let y = -height; y < 256; y += height) for (let x = -width; x < 256; x += width) {
        const tone = 182 + ((x * 13 + y * 7 + 997) >>> 0) % 43;
        c.fillStyle = `rgb(${tone},${tone - 5},${tone - 12})`;
        c.fillRect(x + ((Math.floor(y / height) % 2) * width / 2), y, width - 1.3, height - 1.3);
      }
    }
    // Fine, repeatable salt/weathering grain.
    for (let i = 0; i < 1700; i++) {
      c.fillStyle = i % 2 ? "rgba(35,42,40,.045)" : "rgba(255,255,255,.06)";
      c.fillRect((i * 73) % 256, (i * 137 + Math.floor(i / 17)) % 256, 1, 2);
    }
  });
}

export function districtFacadeMaps(kind: FacadeKind) {
  const albedo = texture(`facade:${kind}`, (c) => {
    c.drawImage(claddingTexture(kind).image as HTMLCanvasElement, 0, 0);
    // A narrow sash bay, with lintel, recessed shadow and stone sill.
    c.fillStyle = "rgba(22,28,29,.42)"; c.fillRect(67, 39, 126, 181);
    c.fillStyle = "#dedacb"; c.fillRect(64, 33, 126, 178);
    const glass = c.createLinearGradient(0, 42, 0, 205);
    glass.addColorStop(0, "#293c47"); glass.addColorStop(0.6, "#586b70"); glass.addColorStop(1, "#34444a");
    c.fillStyle = glass; c.fillRect(73, 42, 108, 160);
    c.fillStyle = "rgba(207,224,228,.14)";
    c.beginPath(); c.moveTo(76, 46); c.lineTo(125, 46); c.lineTo(84, 189); c.lineTo(76, 189); c.fill();
    c.fillStyle = "#dad7c9"; c.fillRect(124, 42, 5, 160);
    for (const y of [95, 148]) c.fillRect(73, y, 108, 4);
    c.fillRect(58, 207, 138, 6); c.fillStyle = "#b3b4aa"; c.fillRect(60, 29, 134, 6);
  });
  const emissive = texture(`light:${kind}`, (c) => {
    c.fillStyle = "black"; c.fillRect(0, 0, 256, 256);
    c.fillStyle = "#d1a96d"; c.fillRect(73, 42, 108, 160);
    c.fillStyle = "black"; c.fillRect(124, 42, 5, 160);
    for (const y of [95, 148]) c.fillRect(73, y, 108, 4);
    // Some panes stay dark. The wall/roof never emits light.
    c.fillRect(73, 42, 51, 53); c.fillRect(129, 152, 52, 50);
  });
  return { albedo, emissive };
}

export function winterRoadTexture() {
  return texture("winter:packed-road", (c) => {
    c.fillStyle = "#d5dce0"; c.fillRect(0, 0, 256, 256);
    // Packed, dirty wheel tracks within the existing road ribbon. Decorative
    // only: do not invent snow-cleared lanes, closures, or new road physics.
    for (const x of [61, 169]) {
      const g = c.createLinearGradient(x - 8, 0, x + 35, 0);
      g.addColorStop(0, "rgba(85,99,106,0)");
      g.addColorStop(0.3, "rgba(85,99,106,.55)");
      g.addColorStop(0.75, "rgba(85,99,106,.55)");
      g.addColorStop(1, "rgba(85,99,106,0)");
      c.fillStyle = g; c.fillRect(x - 8, 0, 43, 256);
    }
    for (let i = 0; i < 1500; i++) {
      c.fillStyle = i % 2 ? "rgba(43,64,73,.08)" : "rgba(255,255,255,.2)";
      c.fillRect((i * 73) % 256, (i * 151 + Math.floor(i / 9)) % 256, 1, 2);
    }
  });
}
