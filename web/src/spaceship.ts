import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import gsap from "gsap";
import {
  SHIP_X_ROTATION,
  SHIP_Z_ROTATION,
  SHIP_Y_ROTATION,
  SHIP_START_POSITION,
  SHIP_START_SCALE,
} from "./scene-layout";

export interface Spaceship {
  group: THREE.Group;
  lights: THREE.Group;
  model: THREE.Group | null;
}

export function createSpaceship(): Spaceship {
  const group = new THREE.Group();
  group.position.copy(SHIP_START_POSITION); // start centered, moves to SHIP_POSITION on first scroll

  const lights = new THREE.Group();

  const keyLight = new THREE.DirectionalLight(0xffeedd, 2.0);
  keyLight.position.set(4, 3, -2);
  lights.add(keyLight);

  const fillLight = new THREE.PointLight(0x665544, 0.8, 20);
  fillLight.position.set(-4, -1, -5);
  lights.add(fillLight);

  const rimLight = new THREE.PointLight(0x4488bb, 0.8, 15);
  rimLight.position.set(-1, 2, -1);
  lights.add(rimLight);

  const ambientLight = new THREE.AmbientLight(0x443322, 0.4);
  lights.add(ambientLight);

  // Idle drift — gentle sway
  gsap.to(group.rotation, {
    z: 0.012,
    duration: 5,
    yoyo: true,
    repeat: -1,
    ease: "sine.inOut",
  });

  const spaceship: Spaceship = { group, lights, model: null };

  // Load GLB
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
  loader.setDRACOLoader(dracoLoader);

  loader.load(
    "/models/spaceship.glb",
    (gltf) => {
      const model = gltf.scene;

      // Center geometry at origin
      model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.name.includes("Spaceship_0")) {
          child.geometry.computeBoundingBox();
          const center = child.geometry.boundingBox!.getCenter(new THREE.Vector3());
          child.geometry.translate(-center.x, -center.y, -center.z);
        }
      });

      model.scale.setScalar(SHIP_START_SCALE);
      model.rotation.x = SHIP_X_ROTATION;
      model.rotation.y = SHIP_Y_ROTATION;
      model.rotation.z = SHIP_Z_ROTATION;

      // Hide color variants, fix materials
      model.traverse((child) => {
        if (child.name.includes("Spaceship_1") || child.name.includes("Spaceship_2")) {
          child.visible = false;
          return;
        }
        if (child instanceof THREE.Mesh) {
          const mat = child.material;
          const fix = (m: THREE.Material) => {
            if (m instanceof THREE.MeshStandardMaterial) {
              m.envMapIntensity = 0.3;
              m.roughness = Math.max(m.roughness, 0.4);
              m.side = THREE.FrontSide;
              m.depthWrite = true;
            }
          };
          if (Array.isArray(mat)) mat.forEach(fix);
          else fix(mat);
        }
      });

      spaceship.model = model;
      group.add(model);
    },
    undefined,
    (error) => console.warn("Failed to load spaceship:", error),
  );

  return spaceship;
}

/** Flight vibration — intermittent subtle Y-axis shaking */
export function updateSpaceship(
  spaceship: Spaceship,
  _scrollSpeed: number,
  _delta: number,
) {
  if (!spaceship.group) return;
  const t = performance.now() * 0.001;
  // Layered sine waves at different frequencies for organic feel
  // Intermittent bursts: vibrate for ~0.5s every ~3s
  const burst = Math.max(0, Math.sin(t * 1.1)) ** 8; // sharp peaks every ~3s
  const vibration = burst * (
    Math.sin(t * 14) * 0.0008 +
    Math.sin(t * 21) * 0.0004
  );
  spaceship.group.position.y += vibration;
}
