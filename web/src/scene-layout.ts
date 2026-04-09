import * as THREE from "three";

// Fixed scene composition constants

export const CAMERA_FOV = 55;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 500;

// Planet: centered on screen
export const PLANET_RADIUS = 7;
export const PLANET_SEGMENTS = 64;
export const PLANET_POSITION = new THREE.Vector3(0, -0.5, -14);
// Offscreen positions for horizontal slide
export const PLANET_OFFSCREEN_RIGHT = 25;  // far right (incoming)
export const PLANET_OFFSCREEN_LEFT = -20;  // far left (exiting)

// Ship: project scenes — left side, smaller
export const SHIP_POSITION = new THREE.Vector3(-2, -0.3, -5);
export const SHIP_SCALE = 0.07;
export const SHIP_X_ROTATION = 0.15;
export const SHIP_Z_ROTATION = 0;
export const SHIP_Y_ROTATION = Math.PI * 0.78;

// Ship: start scene — centered, bigger
export const SHIP_START_POSITION = new THREE.Vector3(0, 0, -5);
export const SHIP_START_SCALE = 0.09;

// Text shell
export const TEXT_SHELL_RADIUS = PLANET_RADIUS * 1.02;
