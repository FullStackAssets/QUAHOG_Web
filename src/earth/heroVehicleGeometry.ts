import * as THREE from "three";

// Original game-native, shallow-bevel vehicle geometry. No downloaded or
// franchise-derived vehicle assets. Local forward is +Z, road is Y=0.
export type CarProfile = {
  width: number; length: number; belt: number; floor: number;
  cabFront: number; cabRear: number; roof: number; roofWidth: number;
};

export function carProfile(type: string): CarProfile {
  switch (type) {
    case "bronco": return { width: 1.99, length: 4.28, belt: 1.58, floor: .54, cabFront: .93, cabRear: -1.63, roof: 2.29, roofWidth: .84 };
    case "rav4": return { width: 1.87, length: 4.32, belt: 1.40, floor: .49, cabFront: .65, cabRear: -1.55, roof: 2.02, roofWidth: .76 };
    case "mustang": return { width: 1.94, length: 4.65, belt: 1.09, floor: .34, cabFront: .20, cabRear: -1.50, roof: 1.64, roofWidth: .71 };
    case "nissanz": return { width: 1.86, length: 4.39, belt: 1.01, floor: .32, cabFront: -.04, cabRear: -1.39, roof: 1.53, roofWidth: .71 };
    // NB slice improvements (2026-11-03): infiniti previously fell through
    // to the generic default, so a stolen Infiniti drove on wrong dims.
    // Width/length from the SPECS entry in Vehicles.tsx; belt/floor/cab/roof
    // are sedan-class defaults, labelled as such.
    case "infiniti": return { width: 1.85, length: 4.70, belt: 1.10, floor: .35, cabFront: .30, cabRear: -1.45, roof: 1.70, roofWidth: .74 };
  // Nic's car (2026-11-02): measured Revuelto dims. belt 0.74 puts the
  // headlight beams at y 0.47, the real lamp height — not the mustang's 0.82.
  case "revuelto": return { width: 1.97, length: 4.94, belt: 0.74, floor: .35, cabFront: .90, cabRear: -1.20, roof: 1.16, roofWidth: .80 };
    default: return { width: 1.87, length: 4.60, belt: 1.16, floor: .39, cabFront: .58, cabRear: -1.39, roof: 1.78, roofWidth: .76 };
  }
}

function makeQuads(quads: number[][]): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const q of quads) {
    if (q.length !== 12 || q.some((n) => !Number.isFinite(n))) throw new Error("Invalid vehicle surface");
    positions.push(...q.slice(0, 3), ...q.slice(3, 6), ...q.slice(6, 9));
    positions.push(...q.slice(0, 3), ...q.slice(6, 9), ...q.slice(9, 12));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}

export function bodyGeometry(p: CarProfile) {
  const w = p.width / 2, z = p.length / 2;
  // Tapered bumper / forward engine compartment / waist / rear deck. The
  // smooth, low taper breaks the toy-like rectangular cab/body silhouette.
  const rings = [
    { z: z, w: w * .92, y: p.belt - .21 },
    { z: z - .20, w: w, y: p.belt - .035 },
    { z: p.cabFront + .14, w, y: p.belt },
    { z: p.cabRear - .10, w, y: p.belt },
    { z: -z + .18, w: w * .98, y: p.belt - .045 },
    { z: -z, w: w * .94, y: p.belt - .17 },
  ];
  const quads: number[][] = [];
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    quads.push([-a.w, a.y, a.z, a.w, a.y, a.z, b.w, b.y, b.z, -b.w, b.y, b.z]);
    quads.push([a.w, p.floor, a.z, b.w, p.floor, b.z, b.w, b.y, b.z, a.w, a.y, a.z]);
    quads.push([-b.w, p.floor, b.z, -a.w, p.floor, a.z, -a.w, a.y, a.z, -b.w, b.y, b.z]);
  }
  const front = rings[0], rear = rings[rings.length - 1];
  quads.push([-front.w, p.floor, front.z, front.w, p.floor, front.z, front.w, front.y, front.z, -front.w, front.y, front.z]);
  quads.push([rear.w, p.floor, rear.z, -rear.w, p.floor, rear.z, -rear.w, rear.y, rear.z, rear.w, rear.y, rear.z]);
  return makeQuads(quads);
}

export function cabinGeometry(p: CarProfile) {
  const w = p.width * .48, rw = p.roofWidth;
  const bottomFront = p.cabFront, bottomRear = p.cabRear;
  const topFront = bottomFront - .31, topRear = bottomRear + .24;
  const y0 = p.belt + .015, y1 = p.roof;
  return makeQuads([
    [-rw, y1, topFront, rw, y1, topFront, rw, y1, topRear, -rw, y1, topRear],
    [-w, y0, bottomFront, -rw, y1, topFront, -rw, y1, topRear, -w, y0, bottomRear],
    [rw, y1, topFront, w, y0, bottomFront, w, y0, bottomRear, rw, y1, topRear],
    [-rw, y1, topRear, rw, y1, topRear, w, y0, bottomRear, -w, y0, bottomRear],
    [-w, y0, bottomFront, w, y0, bottomFront, rw, y1, topFront, -rw, y1, topFront],
  ]);
}

export function glassGeometry(p: CarProfile, face: "front" | "rear" | "left" | "right") {
  const w = p.width * .48, rw = p.roofWidth;
  const bf = p.cabFront, br = p.cabRear, tf = bf - .31, tr = br + .24;
  const y0 = p.belt + .095, y1 = p.roof - .065;
  const outer = .018;
  const qw = face === "front" ? [
    -w + .10, y0, bf + outer, w - .10, y0, bf + outer, rw - .10, y1, tf + outer, -rw + .10, y1, tf + outer,
  ] : face === "rear" ? [
    w - .10, y0, br - outer, -w + .10, y0, br - outer, -rw + .10, y1, tr - outer, rw - .10, y1, tr - outer,
  ] : face === "left" ? [
    -w - outer, y0, br + .10, -w - outer, y0, bf - .09, -rw - outer, y1, tf + .10, -rw - outer, y1, tr - .10,
  ] : [
    w + outer, y0, bf - .09, w + outer, y0, br + .10, rw + outer, y1, tr - .10, rw + outer, y1, tf + .10,
  ];
  return makeQuads([qw]);
}
