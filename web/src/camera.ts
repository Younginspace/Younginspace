import * as THREE from "three";
import { CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR } from "./scene-layout";

export function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    window.innerWidth / window.innerHeight,
    CAMERA_NEAR,
    CAMERA_FAR,
  );
  // Camera stays at origin, looking along -Z
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
  return camera;
}
