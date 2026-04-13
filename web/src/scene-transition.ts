import gsap from "gsap";
import * as THREE from "three";
import { PlanetInstance } from "./stars";
import {
  PLANET_POSITION,
  PLANET_LEFT_EXIT,
  getPlanetOrbitPos,
} from "./scene-layout";

export interface ZoomTransitionContext {
  outgoing: PlanetInstance | null; // null = coming from start scene
  incoming: PlanetInstance | null; // null = returning to start
  outgoingIndex: number;
  incomingIndex: number;
  direction: 1 | -1;
  starfield: THREE.Points;
  canvas: HTMLCanvasElement;
  warpOverlay: HTMLElement;
  onComplete: () => void;
}

/**
 * Planet transition:
 *  - Forward : outgoing slides off to camera LEFT (z stays ~the same so it doesn't
 *              loom through camera); incoming slides from its orbit slot into center.
 *  - Reverse : outgoing slides back to its orbit slot (healing the orbit);
 *              incoming slides from LEFT_EXIT back into center (enters from left).
 *
 * Other planets don't move.
 */
export function createZoomTransition(ctx: ZoomTransitionContext): gsap.core.Timeline {
  const tl = gsap.timeline({ onComplete: ctx.onComplete });
  const starMat = ctx.starfield.material as THREE.ShaderMaterial;
  const blurProxy = { blur: 0 };

  const DURATION = 1.2;

  // Outgoing: animate position + fade opacity to 0
  let outgoingTarget: THREE.Vector3 | null = null;
  if (ctx.outgoing) {
    outgoingTarget =
      ctx.direction === 1
        ? PLANET_LEFT_EXIT.clone()
        : getPlanetOrbitPos(ctx.outgoingIndex);
    tl.to(ctx.outgoing.group.position, {
      x: outgoingTarget.x,
      y: outgoingTarget.y,
      z: outgoingTarget.z,
      duration: DURATION,
      ease: "power2.inOut",
    }, 0);
    const outgoingMat = ctx.outgoing.sphere.material as THREE.MeshStandardMaterial;
    tl.to(outgoingMat, {
      opacity: 0,
      duration: DURATION * 0.85, // fade finishes slightly before position settles
      ease: "power2.in",
    }, 0);
  }

  // Incoming: start hidden (opacity 0), fade in while flying into position
  if (ctx.incoming) {
    ctx.incoming.group.visible = true;
    const incomingMat = ctx.incoming.sphere.material as THREE.MeshStandardMaterial;
    incomingMat.opacity = 0;
    tl.to(ctx.incoming.group.position, {
      x: PLANET_POSITION.x,
      y: PLANET_POSITION.y,
      z: PLANET_POSITION.z,
      duration: DURATION,
      ease: "power2.inOut",
    }, 0);
    tl.to(incomingMat, {
      opacity: 1,
      duration: DURATION * 0.9,
      ease: "power2.out",
    }, 0.05);
  }

  // ── Blur + warp (midpoint crossfade) ──
  tl.to(blurProxy, {
    blur: 6,
    duration: DURATION * 0.45,
    ease: "power2.in",
    onUpdate() { ctx.canvas.style.filter = `blur(${blurProxy.blur}px)`; },
  }, 0.1);
  tl.to(blurProxy, {
    blur: 0,
    duration: DURATION * 0.45,
    ease: "power2.out",
    onUpdate() {
      ctx.canvas.style.filter =
        blurProxy.blur < 0.5 ? "none" : `blur(${blurProxy.blur}px)`;
    },
  }, 0.1 + DURATION * 0.5);

  tl.to(ctx.warpOverlay, { opacity: 0.35, duration: DURATION * 0.45, ease: "power2.in" }, 0.1);
  tl.to(ctx.warpOverlay, { opacity: 0,    duration: DURATION * 0.45, ease: "power2.out" }, 0.1 + DURATION * 0.5);

  tl.to(starMat.uniforms.warpFactor, {
    value: 0.4,
    duration: DURATION * 0.45,
    ease: "power2.in",
  }, 0.1);
  tl.to(starMat.uniforms.warpFactor, {
    value: 0.0,
    duration: DURATION * 0.45,
    ease: "power2.out",
  }, 0.1 + DURATION * 0.5);

  return tl;
}
