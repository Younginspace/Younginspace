import * as THREE from "three";

/**
 * Cursor-driven ship orbit.
 *
 * Mouse position drives the ship to swing around a fixed pivot point that sits
 * in FRONT of the ship's nose. Up to ±maxAngle (default 90°) yaw + pitch.
 *
 * Reusable: each scene that wants this effect supplies its own basePosition,
 * pivotOffset (typically nose-direction × distance), and ship reference.
 *
 * Important: the consumer must call update() BEFORE the ship's per-frame
 * vibration is applied, so vibration adds tiny oscillation on top of the
 * orbit-driven base position rather than being overwritten.
 */

export interface ShipCursorOrbitConfig {
  shipGroup: THREE.Group;
  /** Where the ship sits when mouse is at center (no orbit applied) */
  basePosition: THREE.Vector3;
  /** Offset from basePosition to the pivot point (typically noseDir × distance) */
  pivotOffset: THREE.Vector3;
  /** Max orbit angle in radians. Default Math.PI / 2 (= 90°) */
  maxAngle?: number;
  /** Smoothing factor 0..1. Default 0.06 */
  damping?: number;
}

export interface ShipCursorOrbit {
  enable(): void;
  disable(): void;
  /** Hot-swap the base position + pivot offset (e.g. for a different scene) */
  setBase(basePosition: THREE.Vector3, pivotOffset: THREE.Vector3): void;
  /** Hot-swap the max orbit angle (different scenes can use different radii) */
  setMaxAngle(rad: number): void;
  /** Call every frame; auto no-ops once settled at neutral */
  update(): void;
  dispose(): void;
}

export function createShipCursorOrbit(cfg: ShipCursorOrbitConfig): ShipCursorOrbit {
  let maxAngle = cfg.maxAngle ?? Math.PI / 2;
  const damping = cfg.damping ?? 0.06;

  const base = cfg.basePosition.clone();
  const pivotOff = cfg.pivotOffset.clone();
  const pivot = base.clone().add(pivotOff);
  const initialV = new THREE.Vector3().subVectors(base, pivot); // ship-to-pivot inverse vector

  let active = false;
  let settled = true;
  const target = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };

  const onMove = (e: MouseEvent) => {
    target.x = (e.clientX / window.innerWidth - 0.5) * 2;
    target.y = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener("mousemove", onMove);

  const _v = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();

  return {
    enable() {
      active = true;
      settled = false;
    },
    /**
     * Stop affecting ship position immediately. Ship stays at whatever orbit
     * position it was at (no lerp back to base) — so the next animation
     * (e.g. a GSAP transition) can take over from the current spot smoothly.
     */
    disable() {
      active = false;
      smooth.x = 0;
      smooth.y = 0;
      settled = true;
    },
    setBase(basePosition, pivotOffset) {
      base.copy(basePosition);
      pivotOff.copy(pivotOffset);
      pivot.copy(base).add(pivotOff);
      initialV.subVectors(base, pivot);
      settled = false; // re-apply after rebase
    },
    setMaxAngle(rad) {
      maxAngle = rad;
    },
    update() {
      if (!active && settled) return;

      const tx = active ? target.x : 0;
      const ty = active ? target.y : 0;
      smooth.x += (tx - smooth.x) * damping;
      smooth.y += (ty - smooth.y) * damping;

      // Settled at neutral while disabled — snap to base, mark settled, no-op next time
      if (!active && Math.abs(smooth.x) < 0.001 && Math.abs(smooth.y) < 0.001) {
        smooth.x = 0;
        smooth.y = 0;
        settled = true;
        cfg.shipGroup.position.copy(base);
        return;
      }

      // Map mouse to orbit angles
      // Yaw  (around Y): mouseX>0 → ship swings right
      // Pitch(around X): mouseY>0 (mouse at bottom) → ship swings down
      const yaw = smooth.x * maxAngle;
      const pitch = smooth.y * maxAngle;

      _e.set(pitch, yaw, 0, "YXZ");
      _q.setFromEuler(_e);
      _v.copy(initialV).applyQuaternion(_q);
      cfg.shipGroup.position.copy(pivot).add(_v);
    },
    dispose() {
      window.removeEventListener("mousemove", onMove);
    },
  };
}
