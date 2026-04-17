import * as THREE from "three";

// Fixed scene composition constants

export const CAMERA_FOV = 55;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 500;

// ── Planet orbit along Z axis, offset 30° to camera's right ──
// Direction = (sin30°, 0, -cos30°) from near slot to far slot
const ORBIT_ANGLE = Math.PI / 6; // 30°
export const ORBIT_DIRECTION = new THREE.Vector3(
  Math.sin(ORBIT_ANGLE),
  0,
  -Math.cos(ORBIT_ANGLE),
).normalize();
export const PLANET_SPACING = 22; // world units between adjacent planets along orbit

// Planet: active "center" slot (world position)
export const PLANET_RADIUS = 5;
export const PLANET_SEGMENTS = 64;
export const PLANET_POSITION = new THREE.Vector3(0, -0.5, -14);

// Local position for planet i inside orbitGroup (orbitGroup starts at origin for scene 0).
// Planet 0 sits at PLANET_POSITION; subsequent planets step along ORBIT_DIRECTION.
export function getPlanetOrbitPos(index: number): THREE.Vector3 {
  return PLANET_POSITION.clone().add(
    ORBIT_DIRECTION.clone().multiplyScalar(PLANET_SPACING * index),
  );
}

// Where an outgoing planet flies to — off-screen to camera's left, same z depth
// so the planet does NOT loom toward or pass through the camera.
export const PLANET_LEFT_EXIT = new THREE.Vector3(-26, -1.5, -14);

// Legacy offscreen positions — kept for any residual code
export const PLANET_OFFSCREEN_RIGHT = 25;
export const PLANET_OFFSCREEN_LEFT = -20;

// Ship: project scenes — default/fallback (right side) + 3/4 away-facing pose
export const SHIP_POSITION = new THREE.Vector3(2, -0.3, -5);
export const SHIP_SCALE = 0.07;
export const SHIP_X_ROTATION = 0.15;
export const SHIP_Z_ROTATION = 0;
// +0.52 offset (~30°) from previous PI*0.78 — more horizontal "grazing" pose
export const SHIP_Y_ROTATION = Math.PI * 0.78 + 0.52;

// Ship: start scene — smaller, pure side profile, nose pointing right (exhaust to left)
// Group stays centered (so view-mode orbits around screen center);
// model is offset within the group so the hull visually sits lower-left.
export const SHIP_START_POSITION = new THREE.Vector3(0, 0, -5);
export const SHIP_START_SCALE = 0.055;
export const SHIP_START_X_ROTATION = 0.06;             // slight forward tilt
// 135° = 3/4 view: nose into scene (front-right), tail rotated 45° toward camera
export const SHIP_START_Y_ROTATION = Math.PI * 0.75;
export const SHIP_START_Z_ROTATION = 0;
// Offset applied to the model (not the group) — shifts visual hull without moving the pivot
export const SHIP_START_MODEL_OFFSET = new THREE.Vector3(-1.2, -0.5, 0);

// Ship: intro fly-in origin (off-screen right, slightly above)
export const SHIP_INTRO_POSITION = new THREE.Vector3(-14, 2, -10);

// Ship: per-project position/scale (keyed by project id) — ALL right side
// Design: vary Y (vertical) and Z (depth) for visual variety, X always > 0
export interface ShipConfig {
  position: THREE.Vector3;
  scale: number;
}

// Each project: ship "passing by" the planet at a different angle/distance.
// Spread across X (1.5–3.2), Y (-0.5..0.7), Z (-7.5..-5.0), scale (0.045–0.072)
// so each scene has a distinctly different fly-by composition.
export const SHIP_CONFIGS: Record<string, ShipConfig> = {
  "hail-mary":      { position: new THREE.Vector3(2.0,  0.5, -5.8), scale: 0.060 }, // mid-right, upper, mid-distance
  "moss-fate":      { position: new THREE.Vector3(2.5,  0.5, -5.0), scale: 0.055 }, // mid-right, upper, clear of planet
  "gosling-cinema": { position: new THREE.Vector3(1.5, -0.4, -5.0), scale: 0.072 }, // closer right, low — closest pass
  "edgespark":      { position: new THREE.Vector3(2.6,  0.7, -6.5), scale: 0.052 }, // right, high arc, distant
};

export function getShipConfig(projectId: string): ShipConfig {
  return SHIP_CONFIGS[projectId] ?? { position: SHIP_POSITION, scale: SHIP_SCALE };
}

// Ship exhaust: position in MODEL local space (before scale)
export const SHIP_EXHAUST_POSITION = new THREE.Vector3(0, -1.5, -24.5);

// Text shell
export const TEXT_SHELL_RADIUS = PLANET_RADIUS * 1.02;
