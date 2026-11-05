import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { usePackGLB } from "./packLoader";

// A rigged P005 pedestrian: a shared humanoid joint hierarchy (hips, spine,
// head, arms, legs) with baked Idle + Walk clips, replacing the single
// CesiumMan figure for ambient peds. The player keeps Franklin; only
// StreetLife peds use this component.
//
// Bodies are game-frame rigs (see pack_fix.py): joints carry game-frame
// translations, part rotations bake the file-to-game +90deg X rotation, and
// the clips target joint nodes by name. Garments (optional) are separate
// P005 files, frame-fixed at build time; here the garment scene is centred
// on its own bbox and hung under the spine joint, so it bobs and leans with
// the body. Garment sleeves are static (they do not swing with the arms) —
// a noted v1 limitation, invisible at pedestrian viewing distances.
// Uniformed bodies (police, fire, paramedic, crews) take no garment: their
// uniforms are baked into the body file.
//
// Stream B (2026-11-03) additions — both optional, existing callers
// (body + garment + moving) behave exactly as before when they are absent:
// - skin: per-instance skin tone. The body's 'skin' material is CLONED
//   before tinting, because usePackGLB clones meshes but SHARES materials:
//   tinting in place would retint every ped using the same body file.
//   Only meshes whose material is named 'skin' are touched, so uniforms,
//   hair and caps keep their baked colours.
// - headgear: a second P005 attachment hung under joint_head (hair, beard,
//   hats, glasses). Hair/beard files ship a head sphere in the 'skin'
//   material alongside the hair; the body already has a head, so those
//   skin-material meshes are stripped or the ped gets two heads (z-fighting
//   twin). Hats/glasses carry no skin mesh, so stripping is a no-op there.
//   Placement is bbox-centre on the head joint plus a per-piece lift
//   (HEADGEAR_LIFT): MUST-EYEBALL on staging. The lifts are computed from
//   pedestrian_a geometry (head joint 1.40 m, head centre +0.18 m, head top
//   ~1.73 m) so each piece's centre lands at its anatomical target
//   (hair cap over the crown, beard at the chin, glasses at eye level).
//   Bodies differ in height (1.51–1.79 m), so a lift that is right on
//   pedestrian_a may sit slightly high/low on varied_stature — tune once
//   on staging, do not ship blind.
const HEADGEAR_LIFT: Record<string, number> = {
  hair_short: 0.2,
  hair_long: 0.06, // long hair hangs down the back; its bbox centre is low
  beard_library: 0.1, // beard centre sits at chin/mouth level
  beanie_hat: 0.23,
  harbor_cap: 0.3,
  hardhat: 0.3,
  eyewear: 0.22, // glasses centre at eye level, just above head centre
};

export function RiggedPedestrian({
  body,
  garment,
  headgear,
  skin,
  moving,
}: {
  body: string;
  garment?: string;
  headgear?: string;
  skin?: string;
  moving?: () => boolean;
}) {
  const { scene, animations } = usePackGLB(`/packs/pack005/${body}.glb`);
  const { scene: garmentScene } = usePackGLB(
    garment ? `/packs/pack005/${garment}.glb` : "",
  );
  const { scene: headgearScene } = usePackGLB(
    headgear ? `/packs/pack005/${headgear}.glb` : "",
  );
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentRef = useRef<THREE.AnimationAction | null>(null);

  const dressed = useMemo(() => {
    if (!scene) return null;
    if (skin) {
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        mats.forEach((m, idx) => {
          if (m && m.name === "skin") {
            const tinted = m.clone();
            (tinted as THREE.MeshStandardMaterial).color.set(skin);
            if (Array.isArray(mesh.material)) mesh.material[idx] = tinted;
            else mesh.material = tinted;
          }
        });
      });
    }
    if (garmentScene) {
      // Centre the garment on its own bbox, then hang it under the spine
      // joint so the garment's centre lands on the torso centre.
      garmentScene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(garmentScene);
      const centre = box.getCenter(new THREE.Vector3());
      garmentScene.position.copy(centre).negate();
      const spine = scene.getObjectByName("joint_spine");
      if (spine) spine.add(garmentScene);
      else scene.add(garmentScene);
    }
    if (headgearScene) {
      // Strip the bundled head sphere (skin material) from hair/beard
      // files; the body already has a head. Collect first, then remove —
      // never mutate the graph during traverse.
      const bundledHeads: { parent: THREE.Object3D; mesh: THREE.Object3D }[] =
        [];
      headgearScene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || !mesh.parent) return;
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        if (mats.some((m) => m && m.name === "skin")) {
          bundledHeads.push({ parent: mesh.parent, mesh });
        }
      });
      for (const { parent, mesh } of bundledHeads) parent.remove(mesh);
      headgearScene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(headgearScene);
      if (!box.isEmpty()) {
        const centre = box.getCenter(new THREE.Vector3());
        headgearScene.position.copy(centre).negate();
        headgearScene.position.y += HEADGEAR_LIFT[headgear ?? ""] ?? 0;
        const head = scene.getObjectByName("joint_head");
        if (head) head.add(headgearScene);
        else scene.add(headgearScene);
      }
    }
    return scene;
  }, [scene, garmentScene, headgearScene, skin]);

  useEffect(() => {
    if (!dressed) return;
    const mixer = new THREE.AnimationMixer(dressed);
    mixerRef.current = mixer;
    const byName = new Map(animations.map((c) => [c.name, c]));
    const walk = byName.get("Walk");
    if (walk) {
      const action = mixer.clipAction(walk);
      action.play();
      currentRef.current = action;
    }
    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
      currentRef.current = null;
    };
  }, [dressed, animations]);

  useFrame((_, delta) => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    // StreetLife's moving() means "alive" (not dead, not knocked down).
    // Alive peds are always walking; dead/down peds freeze mid-pose, the
    // same behaviour ModelCharacter had with CesiumMan.
    if (moving && !moving()) {
      mixer.timeScale = 0;
      return;
    }
    mixer.timeScale = 1;
    mixer.update(Math.min(delta, 0.05));
  });

  if (!dressed) return null;
  return <primitive object={dressed} />;
}
