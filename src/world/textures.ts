import * as THREE from "three";

// Small procedural canvas textures (no asset files needed, works offline).

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!];
}

// Anisotropic filtering keeps tiling surfaces (roads, ground) crisp at grazing
// angles instead of shimmering/blurring. 16 is clamped to the GPU max by three.
const ANISO = 16;

// Colour map: canvas pixels are sRGB-encoded, so tag them sRGB or three reads
// them as linear and everything looks washed-out/muddy (the "brutal" look).
function asColor<T extends THREE.Texture>(t: T): T {
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  t.needsUpdate = true;
  return t;
}
// Data map (normal maps): must stay linear; just sharpen with anisotropy.
function asData<T extends THREE.Texture>(t: T): T {
  t.anisotropy = ANISO;
  t.needsUpdate = true;
  return t;
}

// A tileable surface normal map (Phase 2) — fakes fine bumpiness so asphalt /
// ground catch the light + IBL instead of reading dead flat. Shared singleton.
let _noiseNormal: THREE.Texture | null = null;
export function makeNoiseNormal(): THREE.Texture {
  if (_noiseNormal) return _noiseNormal;
  const [c, ctx] = canvas(128);
  ctx.fillStyle = "#8080ff"; ctx.fillRect(0, 0, 128, 128); // flat normal
  for (let i = 0; i < 700; i++) {
    const x = Math.random() * 128, y = Math.random() * 128, r = 1 + Math.random() * 3;
    const dx = (Math.random() - 0.5) * 90, dy = (Math.random() - 0.5) * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgb(${128 + dx},${128 + dy},255)`);
    g.addColorStop(1, "rgba(128,128,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.Texture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 8);
  _noiseNormal = asData(t); // normal map → linear
  return _noiseNormal;
}

// Oil/grime splotch (Phase 2) — soft dark radial blob on transparent.
let _grime: THREE.Texture | null = null;
export function makeGrime(): THREE.Texture {
  if (_grime) return _grime;
  const [c, x] = canvas(64);
  x.clearRect(0, 0, 64, 64);
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, "rgba(10,10,12,0.5)");
  g.addColorStop(0.6, "rgba(20,18,16,0.28)");
  g.addColorStop(1, "rgba(20,18,16,0)");
  x.fillStyle = g; x.beginPath(); x.arc(32, 32, 30, 0, Math.PI * 2); x.fill();
  _grime = asColor(new THREE.Texture(c)); return _grime;
}

// Zebra crosswalk patch (Phase 2) — white bars on transparent, for intersections.
let _zebra: THREE.Texture | null = null;
export function makeZebra(): THREE.Texture {
  if (_zebra) return _zebra;
  const [c, x] = canvas(128);
  x.clearRect(0, 0, 128, 128);
  x.fillStyle = "rgba(236,236,228,0.9)";
  for (let i = 8; i < 128; i += 22) x.fillRect(i, 6, 11, 116);
  _zebra = asColor(new THREE.Texture(c)); return _zebra;
}

// Façade maps (§ Phase 1): one tileable cell ≈ one floor (~3.2 m). `albedo` is
// white wall + dark glass window (multiplies the per-building base colour);
// `emissive` is black wall + warm lit window (glows at night). Shared singletons.
let _facade: { albedo: THREE.Texture; emissive: THREE.Texture } | null = null;
export function makeFacadeMaps() {
  if (_facade) return _facade;
  const S = 128;
  const [ca, a] = canvas(S);   // albedo
  const [ce, e] = canvas(S);   // emissive
  // wall
  a.fillStyle = "#ffffff"; a.fillRect(0, 0, S, S);          // white → keep base colour
  e.fillStyle = "#000000"; e.fillRect(0, 0, S, S);          // black → wall doesn't glow
  // window opening, centred, taller than wide (typical sash window)
  const mx = 30, my = 20, w = S - mx * 2, h = S - my * 2;
  // --- albedo ---
  // light frame/casing around the opening
  a.fillStyle = "#d7d4cc"; a.fillRect(mx - 4, my - 4, w + 8, h + 8);
  // glass with a vertical sky-reflection gradient (dark at top → lighter low)
  const gg = a.createLinearGradient(0, my, 0, my + h);
  gg.addColorStop(0, "#1c252f"); gg.addColorStop(0.55, "#2c3947"); gg.addColorStop(1, "#3a4856");
  a.fillStyle = gg; a.fillRect(mx, my, w, h);
  // a soft diagonal glare streak across the panes
  a.save(); a.beginPath(); a.rect(mx, my, w, h); a.clip();
  a.strokeStyle = "rgba(210,225,235,0.18)"; a.lineWidth = 7;
  a.beginPath(); a.moveTo(mx - 6, my + h * 0.7); a.lineTo(mx + w * 0.7, my - 6); a.stroke();
  a.restore();
  // muntins: 2 vertical × 3 horizontal panes, plus the meeting rail a touch thicker
  a.fillStyle = "#cfccc4";
  a.fillRect(mx + w / 2 - 1.5, my, 3, h);                     // vertical mullion
  for (const fy of [my + h / 3, my + (2 * h) / 3]) a.fillRect(mx, fy - 1.5, w, 3);
  a.fillStyle = "#bfbcb4"; a.fillRect(mx, my + h / 2 - 2, w, 4); // meeting rail
  // sill shadow under the opening
  a.fillStyle = "rgba(0,0,0,0.18)"; a.fillRect(mx - 4, my + h + 4, w + 8, 4);
  // --- emissive (lit at night) ---
  e.fillStyle = "#ffcf8a"; e.fillRect(mx, my, w, h);
  e.fillStyle = "#000000";
  e.fillRect(mx + w / 2 - 1.5, my, 3, h);
  for (const fy of [my + h / 3, my + h / 2, my + (2 * h) / 3]) e.fillRect(mx, fy - 1.5, w, 3);
  const albedo = asColor(new THREE.Texture(ca)); albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping; albedo.needsUpdate = true;
  const emissive = asColor(new THREE.Texture(ce)); emissive.wrapS = emissive.wrapT = THREE.RepeatWrapping; emissive.needsUpdate = true;
  _facade = { albedo, emissive };
  return _facade;
}

/** A 1980s flyer/poster (radio station or street-feast), procedural. */
export function makePoster(variant: number): THREE.Texture {
  const [c, ctx] = canvas(256);
  const PALES = [
    { bg: "#1c1140", fg: "#ff7ad9", sub: "#ffcf4a", t1: "WHALE 92.1", t2: "CLASSIC ROCK" },
    { bg: "#3a1010", fg: "#ffd24a", sub: "#fff", t1: "THE RAGE", t2: "1480 AM TALK" },
    { bg: "#0c2230", fg: "#5ad0ff", sub: "#ffcf4a", t1: "MARÉ ALTA", t2: "RECORDS · LPs" },
    { bg: "#102810", fg: "#ffd24a", sub: "#fff", t1: "FEAST OF THE", t2: "BLESSED SACRAMENT" },
  ];
  const p = PALES[variant % PALES.length];
  ctx.fillStyle = p.bg; ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = p.sub; ctx.lineWidth = 8; ctx.strokeRect(10, 10, 236, 236);
  ctx.textAlign = "center";
  ctx.fillStyle = p.fg; ctx.font = "bold 40px Georgia";
  ctx.fillText(p.t1, 128, 110);
  ctx.fillStyle = p.sub; ctx.font = "bold 22px Georgia";
  ctx.fillText(p.t2, 128, 150);
  ctx.fillStyle = p.fg; ctx.font = "16px Georgia";
  ctx.fillText("★ NEW BEDFORD ★", 128, 200);
  return asColor(new THREE.Texture(c));
}

// Spray-paint graffiti tag on transparent (Phase 2 weathering) — colourful
// scrawl meant to sit on building walls near the core. `variant` picks a word
// + palette. Returns an RGBA texture (transparent background).
export function makeGraffiti(variant: number): THREE.Texture {
  const [c, ctx] = canvas(256);
  ctx.clearRect(0, 0, 256, 256);
  const PAL = [
    { fg: "#ff3ea5", ed: "#1a0a14", word: "QUOHOG" },
    { fg: "#37e0ff", ed: "#06141a", word: "SOUTHIE" },
    { fg: "#7cff5a", ed: "#0a1606", word: "THE NECK" },
    { fg: "#ffd24a", ed: "#1a1404", word: "WHALERS" },
    { fg: "#b88aff", ed: "#120a1a", word: "ACUSHNET" },
  ];
  const p = PAL[variant % PAL.length];
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  // a few random spray-can scribbles behind the tag
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(${40 + Math.random() * 180},${40 + Math.random() * 180},${40 + Math.random() * 180},0.5)`;
    ctx.lineWidth = 3 + Math.random() * 4;
    ctx.beginPath();
    ctx.moveTo(20 + Math.random() * 60, 40 + Math.random() * 170);
    for (let k = 0; k < 3; k++) ctx.lineTo(40 + Math.random() * 200, 40 + Math.random() * 170);
    ctx.stroke();
  }
  // the tag — bold outlined "bubble" word, italic for attitude
  ctx.font = "italic 900 64px Impact, sans-serif";
  ctx.lineJoin = "round";
  ctx.strokeStyle = p.ed; ctx.lineWidth = 12;
  ctx.strokeText(p.word, 128, 128);
  ctx.fillStyle = p.fg;
  ctx.fillText(p.word, 128, 128);
  // drips
  ctx.fillStyle = p.fg;
  for (let i = 0; i < 5; i++) {
    const x = 50 + Math.random() * 160;
    ctx.fillRect(x, 150, 2 + Math.random() * 2, 10 + Math.random() * 40);
  }
  return asColor(new THREE.Texture(c));
}
export function makeGroundTexture(): THREE.Texture {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = "#3b3d44";
  ctx.fillRect(0, 0, 256, 256);
  // speckle
  for (let i = 0; i < 2600; i++) {
    const v = 40 + Math.random() * 50;
    ctx.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + Math.random() * 0.25})`;
    const s = 1 + Math.random() * 3;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  // faint paving grid
  ctx.strokeStyle = "rgba(20,20,24,0.5)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return asColor(t);
}

/** Region terrain base — soft mottled grass/earth (no hard paving grid), so the
 * land AROUND the city reads as ground, not one giant concrete slab. Roads,
 * sidewalks and lots draw their own surfaces on top. Shared singleton. */
let _terrain: THREE.Texture | null = null;
export function makeTerrainTexture(): THREE.Texture {
  if (_terrain) return _terrain;
  const S = 256;
  const [c, ctx] = canvas(S);
  // base coastal-meadow green
  ctx.fillStyle = "#6f7a4f";
  ctx.fillRect(0, 0, S, S);
  // low-frequency tonal patches (grass / dry grass / soil) via soft blobs
  const blobs: [string, number][] = [
    ["#7c884f", 26], ["#63704a", 30], ["#8a8a58", 18], ["#5d6a46", 24], ["#86744e", 16],
  ];
  for (let i = 0; i < 90; i++) {
    const [col, rad] = blobs[i % blobs.length];
    const x = Math.random() * S, y = Math.random() * S, r = rad + Math.random() * rad;
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.4; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // fine speckle so it doesn't read flat up close
  for (let i = 0; i < 2400; i++) {
    const v = 70 + Math.random() * 50;
    ctx.fillStyle = `rgba(${v},${v + 8},${v - 18},${0.15 + Math.random() * 0.2})`;
    const s = 1 + Math.random() * 2;
    ctx.fillRect(Math.random() * S, Math.random() * S, s, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  _terrain = asColor(t);
  return _terrain;
}

/** Cobblestone texture for the historic district (rounded granite setts). */
export function makeCobbleTexture(): THREE.Texture {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = "#4a4742";
  ctx.fillRect(0, 0, 256, 256);
  const S = 22; // sett spacing
  for (let y = -S; y < 256 + S; y += S) {
    const row = Math.round(y / S);
    for (let x = -S; x < 256 + S; x += S) {
      const ox = (row % 2) * (S / 2); // running-bond offset
      const cx = x + ox + (Math.random() * 4 - 2);
      const cy = y + (Math.random() * 4 - 2);
      const r = S * 0.46 + Math.random() * 2;
      const tone = 70 + Math.random() * 55;
      const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r);
      g.addColorStop(0, `rgb(${tone + 22},${tone + 18},${tone + 12})`);
      g.addColorStop(1, `rgb(${tone - 20},${tone - 22},${tone - 26})`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(20,18,16,0.6)"; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return asColor(t);
}

/** Asphalt texture for road ribbons (u across width, v along length). */
export function makeAsphaltTexture(withLanes: boolean): THREE.Texture {
  const S = 256;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = "#34353c";
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 5200; i++) {
    const v = 35 + Math.random() * 35;
    ctx.fillStyle = `rgba(${v},${v},${v},0.4)`;
    ctx.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random(), 1 + Math.random());
  }
  // dashed centre line along v (texture repeats along length)
  ctx.fillStyle = "#d8c24a";
  if (withLanes) {
    for (let y = 16; y < S; y += 80) ctx.fillRect(124, y, 8, 44);
    // solid edge lines
    ctx.fillStyle = "#cfcfcf";
    ctx.fillRect(20, 0, 6, S);
    ctx.fillRect(230, 0, 6, S);
  } else {
    for (let y = 16; y < S; y += 80) ctx.fillRect(125, y, 6, 36);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return asColor(t);
}

/** Bumpy normal-ish map for the water surface (scrolled for shimmer). */
export function makeWaterNormal(): THREE.Texture {
  const [c, ctx] = canvas(128);
  ctx.fillStyle = "#8080ff"; // neutral normal
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 4 + Math.random() * 6);
    g.addColorStop(0, "rgba(150,150,255,0.9)");
    g.addColorStop(1, "rgba(128,128,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return asData(t); // normal map → linear
}
