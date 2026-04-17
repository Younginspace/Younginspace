import * as THREE from "three";
import { createCamera } from "./camera";
import { createStarfield, animateStarfield } from "./starfield";
import { createNebula } from "./nebula";

const PARALLAX_RANGE = 3;
const PARALLAX_DAMPING = 0.08;

export function initGuestbookScene(canvas: HTMLCanvasElement): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000);
  renderer.autoClear = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  const nebulaScene = new THREE.Scene();
  const nebulaCam = new THREE.Camera();
  const nebula = createNebula();
  nebulaScene.add(nebula.mesh);

  const scene = new THREE.Scene();
  const camera = createCamera();
  const starfield = createStarfield();
  scene.add(starfield);

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  const onMouseMove = (e: MouseEvent) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    targetX = nx * PARALLAX_RANGE;
    targetY = -ny * PARALLAX_RANGE;
  };
  window.addEventListener("mousemove", onMouseMove);

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener("resize", onResize);

  const clock = new THREE.Clock();
  let rafId = 0;
  let running = true;

  function tick() {
    if (!running) return;
    rafId = requestAnimationFrame(tick);

    const delta = clock.getDelta() * 1000;
    const elapsed = clock.elapsedTime;

    currentX += (targetX - currentX) * PARALLAX_DAMPING;
    currentY += (targetY - currentY) * PARALLAX_DAMPING;
    camera.position.set(currentX, currentY, 0);
    camera.lookAt(0, 0, -10);

    nebula.update(elapsed);
    animateStarfield(starfield, delta);

    renderer.clear();
    renderer.render(nebulaScene, nebulaCam);
    renderer.clearDepth();
    renderer.render(scene, camera);
  }
  tick();

  return () => {
    running = false;
    cancelAnimationFrame(rafId);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("resize", onResize);
    renderer.dispose();
  };
}
