import { useEffect } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { shared } from "../shared";
import { useGame } from "../store";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Image-based lighting (Phase 2). A procedural PMREM environment (offline, no
// HDRI download) drives real reflections + ambient bounce on every standard
// material — glass, wet roads, car paint, water. Big realism jump for ~nothing.
export function EnvLight() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    const env = target.texture;
    room.dispose();
    scene.environment = env;
    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  useFrame(() => {
    const weather = useGame.getState().weather;
    scene.environmentIntensity = (0.12 + shared.dayT * 0.24) * (weather === "snow" ? 0.7 : 1);
  });
  return null;
}
