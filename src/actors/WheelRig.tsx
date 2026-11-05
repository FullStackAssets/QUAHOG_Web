import React, { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { shared } from "../shared";

/**
 * WheelRig (production port of the v2 staging sandbox component).
 * Spins a baked-car glb's wheel nodes. Production difference from staging:
 * speed is read live from shared.carSpeed (signed forward speed, m/s) instead
 * of a prop, so reverse spins the wheels backwards.
 *
 * Only the exact wheel node names are recognised: wheel_fl, wheel_fr,
 * wheel_rl, wheel_rr. Each wheel's pivot is validated BEFORE spinning:
 * every descendant mesh's geometry centre, in the wheel node's local space,
 * must sit within 1 cm of the node origin. A wheel that fails is warned
 * about and SKIPPED — spinning an origin-at-model-centre wheel would orbit
 * it around the car instead of spinning it on its axle.
 * The component must share the exact cloned scene that is rendered, or it
 * will spin a scene nobody sees.
 */
export const WHEEL_NAMES = ["wheel_fl", "wheel_fr", "wheel_rl", "wheel_rr"] as const;
export type WheelName = (typeof WHEEL_NAMES)[number];
export const PIVOT_TOLERANCE_M = 0.01;

interface WheelRigProps {
  /** Cloned glb scene — the same object rendered by the sibling primitive. */
  scene: THREE.Object3D;
  /** Wheel radius in metres. Default 0.41 (car). */
  wheelR?: number;
  /** Speed source in m/s. Defaults to the player car's shared.carSpeed;
   *  traffic cars pass their own speed so their wheels spin at their pace. */
  getSpeed?: () => number;
}

export const WheelRig: React.FC<WheelRigProps> = ({ scene, wheelR = 0.41, getSpeed }) => {
  const validWheels = useMemo(() => {
    scene.updateMatrixWorld(true);
    const found = new Map<WheelName, THREE.Object3D>();
    scene.traverse((node) => {
      if ((WHEEL_NAMES as readonly string[]).includes(node.name)) {
        found.set(node.name as WheelName, node);
      }
    });

    const valid: THREE.Object3D[] = [];
    for (const name of WHEEL_NAMES) {
      const wheel = found.get(name);
      if (!wheel) {
        console.warn(
          `[WheelRig] missing wheel node "${name}" — expected one node per wheel ` +
            `(wheel_fl, wheel_fr, wheel_rl, wheel_rr). This wheel will not spin.`,
        );
        continue;
      }
      // Pivot check on the wheel's own meshes: direct child meshes when the
      // wheel carries its mesh directly, else all descendant meshes (a
      // multi-primitive wheel loads as a group of meshes). Accessories hung
      // under a wheel node (P006 hubs sit 0.13 m outboard along the axle)
      // ride the spin but must not fail the check — they are on the axle
      // line, so spinning them in place is correct.
      const direct: THREE.Mesh[] = [];
      wheel.children.forEach((child) => {
        if ((child as THREE.Mesh).isMesh) direct.push(child as THREE.Mesh);
      });
      const meshes: THREE.Mesh[] = direct.length > 0 ? direct : [];
      if (meshes.length === 0) {
        wheel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
        });
      }
      if (meshes.length === 0) {
        console.warn(
          `[WheelRig] wheel node "${name}" contains no mesh — cannot validate ` +
            `its pivot, so it will not spin. Give each wheel its own mesh.`,
        );
        continue;
      }
      let worst = 0;
      const centre = new THREE.Vector3();
      for (const mesh of meshes) {
        const geometry = mesh.geometry;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        if (!geometry.boundingBox) continue;
        geometry.boundingBox.getCenter(centre);
        mesh.updateWorldMatrix(true, false);
        const worldCentre = mesh.localToWorld(centre.clone());
        const localCentre = wheel.worldToLocal(worldCentre);
        worst = Math.max(worst, localCentre.length());
      }
      if (worst > PIVOT_TOLERANCE_M) {
        console.warn(
          `[WheelRig] wheel node "${name}" FAILED pivot validation: geometry ` +
            `centre is ${worst.toFixed(3)} m from the node origin ` +
            `(tolerance ${PIVOT_TOLERANCE_M} m). Its origin is probably at the ` +
            `model centre, not the axle centre — spinning it would orbit it ` +
            `around the car. This wheel will not spin.`,
        );
        continue;
      }
      valid.push(wheel);
    }
    return valid;
  }, [scene]);

  useFrame((_, delta) => {
    const speed = getSpeed ? getSpeed() : shared.carSpeed;
    if (!Number.isFinite(speed) || speed === 0 || !Number.isFinite(delta) || delta <= 0) return;
    const angle = (speed * delta) / wheelR;
    for (const wheel of validWheels) {
      wheel.rotation.x += angle;
    }
  });

  return null;
};
