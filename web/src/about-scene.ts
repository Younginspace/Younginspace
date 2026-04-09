import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createCamera } from "./camera";
import { createPlanetSystem, setupPlanet, animatePlanets, preloadTexture } from "./stars";
import { aboutProject, initAbout, showAbout } from "./about";
import { createStarfield, animateStarfield } from "./starfield";
import { createNebula } from "./nebula";
import { createSpaceship, updateSpaceship } from "./spaceship";
import {
  PLANET_POSITION,
  SHIP_POSITION,
  SHIP_SCALE,
} from "./scene-layout";

/**
 * Standalone Three.js scene for the /about page.
 * Reuses the same modules as the main scene but with no scroll navigation.
 * Shows the moon planet + about overlay immediately.
 */
export function initAboutScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000);
  renderer.autoClear = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  // Nebula background
  const nebulaScene = new THREE.Scene();
  const nebulaCam = new THREE.Camera();
  const nebula = createNebula();
  nebulaScene.add(nebula.mesh);

  // Main scene
  const scene = new THREE.Scene();
  const camera = createCamera();

  // OrbitControls — enabled from the start
  const orbitControls = new OrbitControls(camera, canvas);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.08;
  orbitControls.enablePan = false;
  orbitControls.enableZoom = false;
  orbitControls.rotateSpeed = 0.5;
  orbitControls.minDistance = 5;
  orbitControls.maxDistance = 30;
  orbitControls.target.set(0, 0, PLANET_POSITION.z);
  orbitControls.update();

  // Starfield
  const starfield = createStarfield();
  scene.add(starfield);

  // Planet system — only need moon texture
  const planetSystem = createPlanetSystem([]);
  preloadTexture(planetSystem, aboutProject.texture);
  scene.add(planetSystem.sceneGroup);

  // Setup moon planet immediately
  setupPlanet(planetSystem.planetA, aboutProject, planetSystem.textures);
  planetSystem.planetA.group.position.copy(PLANET_POSITION);
  planetSystem.planetA.group.visible = true;

  // Spaceship
  const spaceship = createSpaceship();
  spaceship.group.position.copy(SHIP_POSITION);
  if (spaceship.model) {
    spaceship.model.scale.setScalar(SHIP_SCALE);
  }
  camera.add(spaceship.group);
  camera.add(spaceship.lights);
  scene.add(camera);

  // Wait for model to load, then apply scale
  const checkModel = setInterval(() => {
    if (spaceship.model) {
      spaceship.model.scale.setScalar(SHIP_SCALE);
      clearInterval(checkModel);
    }
  }, 100);

  // DOM setup
  const headerTitleEl = document.getElementById("header-title")!;
  headerTitleEl.style.opacity = "1";
  headerTitleEl.style.cursor = "pointer";
  headerTitleEl.style.pointerEvents = "auto";
  headerTitleEl.addEventListener("click", () => {
    window.location.href = "/";
  });

  // Hide main-page elements
  document.getElementById("title")!.style.display = "none";
  document.getElementById("project-info")!.style.display = "none";
  document.getElementById("scroll-hint")!.style.display = "none";
  document.getElementById("scene-indicator")!.style.display = "none";

  // Show about overlay + shadow immediately
  const aboutShadow = document.getElementById("about-shadow")!;
  aboutShadow.style.display = "block";
  aboutShadow.style.opacity = "1";

  initAbout();
  showAbout();

  // Mark About nav link as active
  const aboutLink = document.querySelector<HTMLElement>('[data-i18n="about"]');
  if (aboutLink) aboutLink.classList.add("active");

  // Resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Render loop
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    animatePlanets(planetSystem, delta);
    updateSpaceship(spaceship, 0, delta);
    animateStarfield(starfield, delta);
    nebula.update(elapsed);
    orbitControls.update();

    renderer.clear();
    renderer.render(nebulaScene, nebulaCam);
    renderer.clearDepth();
    renderer.render(scene, camera);
  }

  animate();
}
