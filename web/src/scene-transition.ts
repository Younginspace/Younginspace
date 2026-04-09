import gsap from "gsap";
import * as THREE from "three";
import { PlanetInstance } from "./stars";
import { ProjectData } from "./data";
import {
  PLANET_POSITION,
  PLANET_OFFSCREEN_RIGHT,
  PLANET_OFFSCREEN_LEFT,
} from "./scene-layout";

export interface TransitionContext {
  currentPlanet: PlanetInstance;
  nextPlanet: PlanetInstance;
  starfield: THREE.Points;
  nextProject: ProjectData;
  setupPlanetFn: (planet: PlanetInstance, project: ProjectData) => void;
  direction: 1 | -1; // 1 = forward (next), -1 = backward (prev)
  canvas: HTMLCanvasElement;
  warpOverlay: HTMLElement;
  onComplete: () => void;
}

/**
 * Horizontal flyby transition:
 * - Forward: current planet slides LEFT (ship flies past), next slides in from RIGHT
 * - Backward: current slides RIGHT, next comes from LEFT
 * - Blur + starfield warp during the crossover
 */
export function createTransition(ctx: TransitionContext): gsap.core.Timeline {
  const tl = gsap.timeline({ onComplete: ctx.onComplete });

  const dir = ctx.direction;
  const current = ctx.currentPlanet;
  const next = ctx.nextPlanet;

  // Setup next planet offscreen on the incoming side
  ctx.setupPlanetFn(next, ctx.nextProject);
  next.group.position.set(
    dir > 0 ? PLANET_OFFSCREEN_RIGHT : PLANET_OFFSCREEN_LEFT,
    PLANET_POSITION.y,
    PLANET_POSITION.z,
  );
  next.group.visible = true;

  const blurProxy = { blur: 0 };
  const starMat = ctx.starfield.material as THREE.ShaderMaterial;

  // ── Phase 1: Current planet slides out + blur in (0 → 0.4s) ──
  const exitX = dir > 0 ? PLANET_OFFSCREEN_LEFT : PLANET_OFFSCREEN_RIGHT;
  tl.to(current.group.position, {
    x: exitX,
    duration: 0.6,
    ease: "power2.in",
  }, 0);

  tl.to(blurProxy, {
    blur: 12,
    duration: 0.3,
    ease: "power2.in",
    onUpdate() {
      ctx.canvas.style.filter = `blur(${blurProxy.blur}px)`;
    },
  }, 0.1);

  tl.to(ctx.warpOverlay, {
    opacity: 0.5,
    duration: 0.3,
    ease: "power2.in",
  }, 0.1);

  tl.to(starMat.uniforms.warpFactor, {
    value: 0.6,
    duration: 0.3,
    ease: "power2.in",
  }, 0.1);

  // Hide current once it's offscreen
  tl.call(() => {
    current.group.visible = false;
  }, [], 0.5);

  // ── Phase 2: Next planet slides in + blur out (0.3 → 0.8s) ──
  tl.to(next.group.position, {
    x: PLANET_POSITION.x,
    y: PLANET_POSITION.y,
    z: PLANET_POSITION.z,
    duration: 0.6,
    ease: "power2.out",
  }, 0.3);

  tl.to(blurProxy, {
    blur: 0,
    duration: 0.3,
    ease: "power2.out",
    onUpdate() {
      ctx.canvas.style.filter =
        blurProxy.blur < 0.5 ? "none" : `blur(${blurProxy.blur}px)`;
    },
  }, 0.5);

  tl.to(ctx.warpOverlay, {
    opacity: 0,
    duration: 0.3,
    ease: "power2.out",
  }, 0.5);

  tl.to(starMat.uniforms.warpFactor, {
    value: 0.0,
    duration: 0.3,
    ease: "power2.out",
  }, 0.5);

  return tl;
}
