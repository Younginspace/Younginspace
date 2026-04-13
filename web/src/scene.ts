import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import gsap from "gsap";
import { projects } from "./data";
import { createCamera } from "./camera";
import { createDebugPanel } from "./debug-panel";
import {
  createPlanetSystem,
  setupPlanet,
  hidePlanet,
  animatePlanets,
  preloadTexture,
} from "./stars";
import { initProjectInfo, showProjectInfo, hideProjectInfo } from "./planet-text";
import { aboutProject, initAbout, showAbout } from "./about";
import { createStarfield, animateStarfield } from "./starfield";
import { createNebula } from "./nebula";
import { createSpaceship, updateSpaceship } from "./spaceship";
import { createScrollController } from "./scroll-controller";
import { createZoomTransition } from "./scene-transition";
import { createShipCursorOrbit } from "./cursor-parallax";
import {
  PLANET_POSITION,
  PLANET_LEFT_EXIT,
  SHIP_POSITION,
  SHIP_SCALE,
  SHIP_START_POSITION,
  SHIP_START_SCALE,
  SHIP_START_X_ROTATION,
  SHIP_START_Y_ROTATION,
  SHIP_START_Z_ROTATION,
  SHIP_START_MODEL_OFFSET,
  SHIP_X_ROTATION,
  SHIP_Y_ROTATION,
  SHIP_Z_ROTATION,
  SHIP_INTRO_POSITION,
  getShipConfig,
  getPlanetOrbitPos,
} from "./scene-layout";

export interface SceneAPI {
  jumpToAbout(): void;
}

export function initScene(canvas: HTMLCanvasElement): SceneAPI {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000);
  renderer.autoClear = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  // --- Nebula background ---
  const nebulaScene = new THREE.Scene();
  const nebulaCam = new THREE.Camera();
  const nebula = createNebula();
  nebulaScene.add(nebula.mesh);

  // Debug mode ?debug=nebula — live-tune nebula uniforms via sliders
  const debugParams = new URLSearchParams(window.location.search);
  if (debugParams.get("debug") === "nebula") {
    const u = nebula.material.uniforms;
    createDebugPanel({
      title: "Nebula",
      sliders: [
        { label: "Intensity", min: 0, max: 2, step: 0.01,
          get: () => u.uIntensity.value, set: (v) => { u.uIntensity.value = v; } },
        { label: "Warmth", min: 0, max: 2, step: 0.01,
          get: () => u.uWarmth.value, set: (v) => { u.uWarmth.value = v; } },
        { label: "Core Glow", min: 0, max: 2, step: 0.01,
          get: () => u.uCoreGlow.value, set: (v) => { u.uCoreGlow.value = v; } },
        { label: "Lift", min: 0, max: 2, step: 0.01,
          get: () => u.uLift.value, set: (v) => { u.uLift.value = v; } },
      ],
    });
  }

  // --- Main 3D scene ---
  const scene = new THREE.Scene();
  const camera = createCamera();

  const orbitControls = new OrbitControls(camera, canvas);
  // No damping — rotation stops the moment the user releases the mouse
  orbitControls.enableDamping = false;
  orbitControls.enabled = false;
  orbitControls.enablePan = false;
  orbitControls.enableZoom = false;
  orbitControls.rotateSpeed = 0.5;

  // Starfield
  const starfield = createStarfield();
  scene.add(starfield);

  // Planet system — orbit layout (4 project planets along Z-axis, 30° right)
  const planetSystem = createPlanetSystem(projects);
  preloadTexture(planetSystem, aboutProject.texture);
  scene.add(planetSystem.orbitGroup);
  scene.add(planetSystem.aboutRoot);
  // Start state: hide all project planets (they appear one at a time on scroll)
  for (const p of planetSystem.planets) p.group.visible = false;

  // Spaceship (camera child)
  const spaceship = createSpaceship();
  camera.add(spaceship.group);
  camera.add(spaceship.lights);
  scene.add(camera);

  // Project info overlay
  initProjectInfo();
  initAbout();

  // --- DOM references ---
  const titleEl = document.getElementById("title")!;
  const startPaneEl = document.getElementById("start-pane")!;
  void startPaneEl; // referenced via getElementById elsewhere, kept for future use

  // Ship cursor orbit — pivot depends on scene (front-of-nose for start, planet for projects)
  const shipOrbit = createShipCursorOrbit({
    shipGroup: spaceship.group,
    basePosition: SHIP_START_POSITION, // overridden by configureShipOrbit() per scene
    pivotOffset: new THREE.Vector3(),
    maxAngle: Math.PI / 4, // ±45°
    damping: 0.05,
  });

  /** Set shipOrbit's base + pivot + angle for the currently active scene, then enable. */
  function configureShipOrbit() {
    if (currentSceneIndex < 0) {
      // Start scene: ±45°, pivot 2 units in front of the ship's nose
      const noseDir = new THREE.Vector3(0, 0, 1).applyEuler(
        new THREE.Euler(SHIP_START_X_ROTATION, SHIP_START_Y_ROTATION, SHIP_START_Z_ROTATION, "XYZ"),
      );
      shipOrbit.setMaxAngle(Math.PI / 4);
      shipOrbit.setBase(SHIP_START_POSITION, noseDir.multiplyScalar(2.0));
      shipOrbit.enable();
    } else if (currentSceneIndex < projects.length) {
      // Project scene: ±15° (1/3 of start scene), pivot is the planet
      // — planet pivot is far away (~8 units), so 45° would swing the ship off-screen
      const cfg = getShipConfig(projects[currentSceneIndex].id);
      const pivotOffset = new THREE.Vector3().subVectors(PLANET_POSITION, cfg.position);
      shipOrbit.setMaxAngle(Math.PI / 12);
      shipOrbit.setBase(cfg.position, pivotOffset);
      shipOrbit.enable();
    }
    // About scene: no orbit (user uses OrbitControls there)
  }
  const warpOverlay = document.getElementById("warp-overlay")!;
  const aboutShadow = document.getElementById("about-shadow")!;

  // --- State ---
  const ABOUT_SCENE_INDEX = projects.length;
  let currentSceneIndex = -1; // -1 = start, 0..N-1 = projects, N = about
  let titleShrunk = false;

  // Initial orbit setup now that currentSceneIndex is declared
  configureShipOrbit();

  // --- Intro: ship off-screen ---
  spaceship.group.position.copy(SHIP_INTRO_POSITION);

  // --- Scroll controller ---
  const totalScenes = projects.length + 1; // start + projects
  const scrollController = createScrollController(totalScenes);

  // --- Title management ---
  function shrinkTitle() {
    if (titleShrunk) return;
    titleShrunk = true;
    startPaneEl.style.transition = "opacity 0.6s ease";
    startPaneEl.style.opacity = "0";
  }
  function expandTitle() {
    if (!titleShrunk) return;
    titleShrunk = false;
    startPaneEl.style.transition = "opacity 0.8s ease";
    startPaneEl.style.opacity = "1";
  }

  // --- Scene indicator dots ---
  const indicatorEl = document.getElementById("scene-indicator");
  if (indicatorEl) {
    const startDot = document.createElement("div");
    startDot.className = "scene-dot active";
    indicatorEl.appendChild(startDot);
    for (let i = 0; i < projects.length; i++) {
      const dot = document.createElement("div");
      dot.className = "scene-dot";
      indicatorEl.appendChild(dot);
    }
  }
  function updateSceneIndicator(projectIndex: number) {
    const dots = document.querySelectorAll(".scene-dot");
    const activeIndex = projectIndex + 1;
    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === activeIndex);
    });
  }

  // --- Scene change handler ---
  function handleSceneChange(direction: 1 | -1) {
    if (currentSceneIndex === ABOUT_SCENE_INDEX) return;
    const nextIndex = currentSceneIndex + direction;
    if (nextIndex < -1 || nextIndex >= projects.length) return;
    if (scrollController.isTransitioning) return;

    scrollController.isTransitioning = true;

    // Kill any in-flight tweens on the ship (e.g. residual intro tween) so new
    // scene-change tweens own the ship position/rotation without conflict.
    const shipTargets: object[] = [spaceship.group.position];
    if (spaceship.model) {
      shipTargets.push(
        spaceship.model.scale,
        spaceship.model.rotation,
        spaceship.model.position,
      );
    }
    gsap.killTweensOf(shipTargets);

    // Helper to animate ship to a given config
    const animateShip = (cfg: { position: THREE.Vector3; scale: number }, dur = 1.0) => {
      gsap.to(spaceship.group.position, {
        x: cfg.position.x, y: cfg.position.y, z: cfg.position.z,
        duration: dur, ease: "power2.inOut",
      });
      if (spaceship.model) {
        gsap.to(spaceship.model.scale, {
          x: cfg.scale, y: cfg.scale, z: cfg.scale,
          duration: dur, ease: "power2.inOut",
        });
      }
    };

    // FROM start → first project: only planet[0] visible, entering from LEFT_EXIT
    if (currentSceneIndex === -1 && direction === 1) {
      shrinkTitle();
      shipOrbit.disable(); // GSAP takes over ship position
      spaceship.exhaust?.setIntensity(0.55);
      animateShip(getShipConfig(projects[0].id));
      if (spaceship.model) {
        gsap.to(spaceship.model.rotation, {
          x: SHIP_X_ROTATION, y: SHIP_Y_ROTATION, z: SHIP_Z_ROTATION,
          duration: 1.0, ease: "power2.inOut",
        });
        // Remove start-scene model offset (return to pivot-centered)
        gsap.to(spaceship.model.position, {
          x: 0, y: 0, z: 0,
          duration: 1.0, ease: "power2.inOut",
        });
      }

      // Hide everything, then position + show only planet[0] with opacity fade-in
      for (const p of planetSystem.planets) p.group.visible = false;
      const p0 = planetSystem.planets[0];
      const p0Mat = p0.sphere.material as THREE.MeshStandardMaterial;
      p0.group.position.copy(PLANET_LEFT_EXIT);
      p0.group.visible = true;
      p0Mat.opacity = 0;
      gsap.to(p0Mat, { opacity: 1, duration: 1.0, ease: "power2.out" });
      // Project info fades in early while planet is still flying in (not at end)
      gsap.delayedCall(0.5, () => showProjectInfo(projects[0]));
      gsap.to(p0.group.position, {
        x: PLANET_POSITION.x, y: PLANET_POSITION.y, z: PLANET_POSITION.z,
        duration: 1.2, ease: "power2.out",
        onComplete: () => {
          currentSceneIndex = 0;
          scrollController.currentScene = 1;
          scrollController.isTransitioning = false;
          updateSceneIndicator(0);
          spaceship.exhaust?.setIntensity(0.18);
          configureShipOrbit(); // pivot now planet
        },
      });
      return;
    }

    // FROM first project → back to start: hide all planets + ship returns
    if (currentSceneIndex === 0 && direction === -1) {
      hideProjectInfo();
      // Start pane text fades in LATER — let the planet/ship motion establish first
      gsap.delayedCall(0.55, () => expandTitle());
      shipOrbit.disable(); // GSAP takes over
      spaceship.exhaust?.setIntensity(0.55);
      animateShip({ position: SHIP_START_POSITION, scale: SHIP_START_SCALE }, 0.8);
      // Rotate back to side profile + restore start-scene model offset
      if (spaceship.model) {
        gsap.to(spaceship.model.rotation, {
          x: SHIP_START_X_ROTATION,
          y: SHIP_START_Y_ROTATION,
          z: SHIP_START_Z_ROTATION,
          duration: 0.8,
          ease: "power2.inOut",
        });
        gsap.to(spaceship.model.position, {
          x: SHIP_START_MODEL_OFFSET.x,
          y: SHIP_START_MODEL_OFFSET.y,
          z: SHIP_START_MODEL_OFFSET.z,
          duration: 0.8,
          ease: "power2.inOut",
        });
      }

      // Planet[0] exits to LEFT_EXIT with fade-out, then hide all planets
      const exitMat = planetSystem.planets[0].sphere.material as THREE.MeshStandardMaterial;
      gsap.to(exitMat, { opacity: 0, duration: 0.7, ease: "power2.in" });
      gsap.to(planetSystem.planets[0].group.position, {
        x: PLANET_LEFT_EXIT.x, y: PLANET_LEFT_EXIT.y, z: PLANET_LEFT_EXIT.z,
        duration: 0.8, ease: "power2.in",
        onComplete: () => {
          for (const p of planetSystem.planets) p.group.visible = false;
          currentSceneIndex = -1;
          scrollController.currentScene = 0;
          scrollController.isTransitioning = false;
          updateSceneIndicator(-1);
          spaceship.exhaust?.setIntensity(0.18);
          configureShipOrbit(); // back to start — pivot is in front of nose again
        },
      });
      return;
    }

    // Project-to-project: only outgoing + incoming planets visible during transition
    hideProjectInfo();
    shipOrbit.disable(); // GSAP takes over ship position
    spaceship.exhaust?.setIntensity(0.55);
    animateShip(getShipConfig(projects[nextIndex].id));

    // Pre-position the incoming planet at its entrance point
    const incoming = planetSystem.planets[nextIndex];
    const incomingStart = direction === 1
      ? getPlanetOrbitPos(nextIndex) // forward: emerge from its distant orbit slot
      : PLANET_LEFT_EXIT;             // reverse: come back in from left
    incoming.group.position.copy(incomingStart);
    incoming.group.visible = true;

    const outgoingPlanet = planetSystem.planets[currentSceneIndex];
    const capturedOutgoingIndex = currentSceneIndex;

    // Next project's info fades in mid-transition, not after
    gsap.delayedCall(0.6, () => showProjectInfo(projects[nextIndex]));

    const tl = createZoomTransition({
      outgoing: outgoingPlanet,
      incoming,
      outgoingIndex: currentSceneIndex,
      incomingIndex: nextIndex,
      direction,
      starfield,
      canvas,
      warpOverlay,
      onComplete: () => {
        // Hide the outgoing planet once it's off-frame
        planetSystem.planets[capturedOutgoingIndex].group.visible = false;
        currentSceneIndex = nextIndex;
        scrollController.currentScene = nextIndex + 1;
        scrollController.isTransitioning = false;
        updateSceneIndicator(nextIndex);
        spaceship.exhaust?.setIntensity(0.18);
        configureShipOrbit(); // re-anchor orbit to new project's planet
      },
    });
    tl.play();
  }

  scrollController.onSceneChange = handleSceneChange;

  scrollController.onModeChange = () => {
    // No view mode for start or project scenes — cursor orbit replaces it.
    // About scene has its own OrbitControls setup inside jumpToAbout.
  };

  // --- Jump to about ---
  function jumpToAbout() {
    if (currentSceneIndex === ABOUT_SCENE_INDEX) return;
    if (scrollController.isTransitioning) return;
    scrollController.isTransitioning = true;

    if (currentSceneIndex >= 0 && currentSceneIndex < projects.length) {
      hideProjectInfo();
    }

    const blurProxy = { blur: 0 };
    gsap.to(blurProxy, {
      blur: 12,
      duration: 0.25,
      ease: "power2.in",
      onUpdate() { canvas.style.filter = `blur(${blurProxy.blur}px)`; },
    });
    gsap.to(warpOverlay, { opacity: 0.6, duration: 0.25, ease: "power2.in" });

    gsap.delayedCall(0.3, () => {
      if (currentSceneIndex === -1) {
        shrinkTitle();
        spaceship.group.position.copy(SHIP_POSITION);
        if (spaceship.model) spaceship.model.scale.setScalar(SHIP_SCALE);
      }

      // Hide the whole orbit, show the about planet
      planetSystem.orbitGroup.visible = false;
      setupPlanet(planetSystem.aboutPlanet, aboutProject, planetSystem.textures);
      planetSystem.aboutPlanet.group.position.copy(PLANET_POSITION);
      planetSystem.aboutPlanet.group.visible = true;

      // Hide ship + lights + disable cursor orbit on about scene
      spaceship.group.visible = false;
      spaceship.lights.visible = false;
      shipOrbit.disable();
      // No black shadow overlay — about scene stands on its own
      aboutShadow.style.display = "none";

      gsap.to(blurProxy, {
        blur: 0,
        duration: 0.35,
        ease: "power2.out",
        onUpdate() {
          canvas.style.filter = blurProxy.blur < 0.5 ? "none" : `blur(${blurProxy.blur}px)`;
        },
      });
      gsap.to(warpOverlay, { opacity: 0, duration: 0.35, ease: "power2.out" });

      currentSceneIndex = ABOUT_SCENE_INDEX;
      scrollController.currentScene = ABOUT_SCENE_INDEX + 1;
      scrollController.isTransitioning = false;
      showAbout();
      updateSceneIndicator(ABOUT_SCENE_INDEX);

      // About is view-only — no drag rotation allowed
      orbitControls.enabled = false;
      scrollController.mode = "view";
      const spaceHint = document.getElementById("space-hint");
      if (spaceHint) spaceHint.style.display = "none";
    });
  }

  // --- Resize ---
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- Render loop ---
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    animatePlanets(planetSystem, delta);
    // Ship cursor orbit: writes ship.group.position absolutely from mouse-driven angle.
    // Must run BEFORE updateSpaceship so vibration adds tiny oscillation on top.
    if (!orbitControls.enabled) shipOrbit.update();
    updateSpaceship(spaceship, 0, delta);
    animateStarfield(starfield, delta);
    nebula.update(elapsed);

    if (orbitControls.enabled) orbitControls.update();

    renderer.clear();
    renderer.render(nebulaScene, nebulaCam);
    renderer.clearDepth();
    renderer.render(scene, camera);
  }
  animate();

  // --- Intro fly-in ---
  // Block scroll only during the first 1.0s — the most visually jumpy window
  // (ship still far off-screen). After that, GSAP overrides handle interruptions.
  scrollController.isTransitioning = true;
  setTimeout(() => {
    scrollController.isTransitioning = false;
  }, 1000);

  const tryBoostIntro = () => {
    if (spaceship.exhaust) {
      spaceship.exhaust.setIntensity(0.55);
      return;
    }
    setTimeout(tryBoostIntro, 100);
  };
  tryBoostIntro();

  const introTl = gsap.timeline({
    onComplete() {
      spaceship.exhaust?.setIntensity(0.18);
      titleEl.style.animation = "breathe 5s ease-in-out infinite";
    },
  });

  introTl.to(spaceship.group.position, {
    x: SHIP_START_POSITION.x,
    y: SHIP_START_POSITION.y,
    z: SHIP_START_POSITION.z,
    duration: 2.4,
    ease: "power3.out",
  }, 0);

  // Text fades in immediately on load (no wait for ship)
  introTl.to(titleEl, {
    opacity: 0.9,
    duration: 0.5,
    ease: "power2.out",
  }, 0);

  const startBodyEl = document.getElementById("start-body");
  if (startBodyEl) {
    introTl.to(startBodyEl, {
      opacity: 0.72,
      duration: 0.4,
      ease: "power2.out",
    }, 0.15);
  }

  // Silence unused-import lint for hidePlanet (exported but not referenced directly here)
  void hidePlanet;

  return { jumpToAbout };
}
