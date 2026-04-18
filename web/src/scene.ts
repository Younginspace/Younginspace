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
import { aboutProject, initAbout, showAbout, hideAbout } from "./about";
import { createStarfield, animateStarfield } from "./starfield";
import { createNebula } from "./nebula";
import { createSpaceship, updateSpaceship } from "./spaceship";
import { createScrollController } from "./scroll-controller";
import { createZoomTransition } from "./scene-transition";
import { createShipCursorOrbit } from "./cursor-parallax";
import { mountGuestbook, unmountGuestbook } from "./guestbook-page";
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

export type SceneMode = "home" | "about" | "guestbook";

export interface SceneAPI {
  enterMode(mode: SceneMode, opts?: { skipIntro?: boolean }): void;
  getMode(): SceneMode | null;
}

const GUESTBOOK_PARALLAX_RANGE = 3;
const GUESTBOOK_PARALLAX_DAMPING = 0.08;

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

  const debugParams = new URLSearchParams(window.location.search);
  if (debugParams.get("debug") === "nebula") {
    const u = nebula.material.uniforms;
    const colorFor = (name: string) => ({
      get: () => "#" + (u[name].value as THREE.Color).getHexString(),
      set: (hex: string) => { (u[name].value as THREE.Color).set(hex); },
    });
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
        { label: "Saturation", min: 0, max: 1, step: 0.01,
          get: () => u.uSaturation.value, set: (v) => { u.uSaturation.value = v; } },
      ],
      colors: [
        { label: "Highlight", ...colorFor("uOchre") },
        { label: "Shadow",    ...colorFor("uRust") },
        { label: "Core",      ...colorFor("uCore") },
        { label: "Edge",      ...colorFor("uEdge") },
      ],
    });
  }

  // --- Main 3D scene ---
  const scene = new THREE.Scene();
  const camera = createCamera();

  const orbitControls = new OrbitControls(camera, canvas);
  orbitControls.enableDamping = false;
  orbitControls.enabled = false;
  orbitControls.enablePan = false;
  orbitControls.enableZoom = false;
  orbitControls.rotateSpeed = 0.5;

  const starfield = createStarfield();
  scene.add(starfield);

  const planetSystem = createPlanetSystem(projects);
  preloadTexture(planetSystem, aboutProject.texture);
  scene.add(planetSystem.orbitGroup);
  scene.add(planetSystem.aboutRoot);
  for (const p of planetSystem.planets) p.group.visible = false;

  const spaceship = createSpaceship();
  camera.add(spaceship.group);
  camera.add(spaceship.lights);
  scene.add(camera);

  initProjectInfo();
  initAbout();

  // --- DOM references ---
  const titleEl = document.getElementById("title")!;
  const startPaneEl = document.getElementById("start-pane")!;
  const warpOverlay = document.getElementById("warp-overlay")!;
  const aboutShadow = document.getElementById("about-shadow")!;

  // --- Ship cursor orbit ---
  const shipOrbit = createShipCursorOrbit({
    shipGroup: spaceship.group,
    basePosition: SHIP_START_POSITION,
    pivotOffset: new THREE.Vector3(),
    maxAngle: Math.PI / 4,
    damping: 0.05,
  });

  function configureShipOrbit() {
    if (currentSceneIndex < 0) {
      const noseDir = new THREE.Vector3(0, 0, 1).applyEuler(
        new THREE.Euler(SHIP_START_X_ROTATION, SHIP_START_Y_ROTATION, SHIP_START_Z_ROTATION, "XYZ"),
      );
      shipOrbit.setMaxAngle(Math.PI / 4);
      shipOrbit.setBase(SHIP_START_POSITION, noseDir.multiplyScalar(2.0));
      shipOrbit.enable();
    } else if (currentSceneIndex < projects.length) {
      const cfg = getShipConfig(projects[currentSceneIndex].id);
      const pivotOffset = new THREE.Vector3().subVectors(PLANET_POSITION, cfg.position);
      shipOrbit.setMaxAngle(Math.PI / 12);
      shipOrbit.setBase(cfg.position, pivotOffset);
      shipOrbit.enable();
    }
  }

  // --- State ---
  const ABOUT_SCENE_INDEX = projects.length;
  let currentSceneIndex = -1;
  let titleShrunk = false;
  let currentMode: SceneMode | null = null;

  // --- Guestbook parallax state (camera slight sway on mouse) ---
  const gbParallax = { tx: 0, ty: 0, cx: 0, cy: 0, active: false };
  function onGuestbookMouseMove(e: MouseEvent) {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    gbParallax.tx = nx * GUESTBOOK_PARALLAX_RANGE;
    gbParallax.ty = -ny * GUESTBOOK_PARALLAX_RANGE;
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

  // --- Scroll controller ---
  const totalScenes = projects.length + 1;
  const scrollController = createScrollController(totalScenes);

  function handleSceneChange(direction: 1 | -1) {
    if (currentMode !== "home") return;
    if (currentSceneIndex === ABOUT_SCENE_INDEX) return;
    const nextIndex = currentSceneIndex + direction;
    if (nextIndex < -1 || nextIndex >= projects.length) return;
    if (scrollController.isTransitioning) return;

    scrollController.isTransitioning = true;

    const shipTargets: object[] = [spaceship.group.position];
    if (spaceship.model) {
      shipTargets.push(spaceship.model.scale, spaceship.model.rotation, spaceship.model.position);
    }
    gsap.killTweensOf(shipTargets);

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

    if (currentSceneIndex === -1 && direction === 1) {
      shrinkTitle();
      shipOrbit.disable();
      spaceship.exhaust?.setIntensity(0.55);
      animateShip(getShipConfig(projects[0].id));
      if (spaceship.model) {
        gsap.to(spaceship.model.rotation, {
          x: SHIP_X_ROTATION, y: SHIP_Y_ROTATION, z: SHIP_Z_ROTATION,
          duration: 1.0, ease: "power2.inOut",
        });
        gsap.to(spaceship.model.position, {
          x: 0, y: 0, z: 0,
          duration: 1.0, ease: "power2.inOut",
        });
      }

      for (const p of planetSystem.planets) p.group.visible = false;
      const p0 = planetSystem.planets[0];
      const p0Mat = p0.sphere.material as THREE.MeshStandardMaterial;
      p0.group.position.copy(PLANET_LEFT_EXIT);
      p0.group.visible = true;
      p0Mat.opacity = 0;
      gsap.to(p0Mat, { opacity: 1, duration: 1.0, ease: "power2.out" });
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
          configureShipOrbit();
        },
      });
      return;
    }

    if (currentSceneIndex === 0 && direction === -1) {
      hideProjectInfo();
      gsap.delayedCall(0.55, () => expandTitle());
      shipOrbit.disable();
      spaceship.exhaust?.setIntensity(0.55);
      animateShip({ position: SHIP_START_POSITION, scale: SHIP_START_SCALE }, 0.8);
      if (spaceship.model) {
        gsap.to(spaceship.model.rotation, {
          x: SHIP_START_X_ROTATION, y: SHIP_START_Y_ROTATION, z: SHIP_START_Z_ROTATION,
          duration: 0.8, ease: "power2.inOut",
        });
        gsap.to(spaceship.model.position, {
          x: SHIP_START_MODEL_OFFSET.x, y: SHIP_START_MODEL_OFFSET.y, z: SHIP_START_MODEL_OFFSET.z,
          duration: 0.8, ease: "power2.inOut",
        });
      }

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
          configureShipOrbit();
        },
      });
      return;
    }

    // Project-to-project
    hideProjectInfo();
    shipOrbit.disable();
    spaceship.exhaust?.setIntensity(0.55);
    animateShip(getShipConfig(projects[nextIndex].id));

    const incoming = planetSystem.planets[nextIndex];
    const incomingStart = direction === 1
      ? getPlanetOrbitPos(nextIndex)
      : PLANET_LEFT_EXIT;
    incoming.group.position.copy(incomingStart);
    incoming.group.visible = true;

    const outgoingPlanet = planetSystem.planets[currentSceneIndex];
    const capturedOutgoingIndex = currentSceneIndex;

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
        planetSystem.planets[capturedOutgoingIndex].group.visible = false;
        currentSceneIndex = nextIndex;
        scrollController.currentScene = nextIndex + 1;
        scrollController.isTransitioning = false;
        updateSceneIndicator(nextIndex);
        spaceship.exhaust?.setIntensity(0.18);
        configureShipOrbit();
      },
    });
    tl.play();
  }

  scrollController.onSceneChange = handleSceneChange;
  scrollController.onModeChange = () => {};

  // ──────────────────────────────────────────────────────────────────
  // Intro fly-in — now called explicitly by enterHome, re-runnable.
  // ──────────────────────────────────────────────────────────────────
  function playIntro() {
    // Kill any in-flight tweens on the ship/text to avoid fighting state
    gsap.killTweensOf([
      spaceship.group.position,
      titleEl,
    ]);
    const startBodyEl = document.getElementById("start-body");
    if (startBodyEl) gsap.killTweensOf(startBodyEl);

    // Reset starting state (ship off-screen, text faded)
    spaceship.group.position.copy(SHIP_INTRO_POSITION);
    titleEl.style.animation = "";
    titleEl.style.opacity = "0";
    if (startBodyEl) startBodyEl.style.opacity = "0";

    // Lock scroll during the first 1s (jumpy window)
    scrollController.isTransitioning = true;
    setTimeout(() => {
      // Only release if no newer transition set it (defensive)
      if (scrollController.isTransitioning) scrollController.isTransitioning = false;
    }, 1000);

    // Boost exhaust during intro (fallback-retry until the ship exhaust is live)
    const tryBoostIntro = () => {
      if (spaceship.exhaust) {
        spaceship.exhaust.setIntensity(0.55);
        return;
      }
      setTimeout(tryBoostIntro, 100);
    };
    tryBoostIntro();

    const tl = gsap.timeline({
      onComplete() {
        spaceship.exhaust?.setIntensity(0.18);
        titleEl.style.animation = "breathe 5s ease-in-out infinite";
      },
    });

    tl.to(spaceship.group.position, {
      x: SHIP_START_POSITION.x,
      y: SHIP_START_POSITION.y,
      z: SHIP_START_POSITION.z,
      duration: 2.4,
      ease: "power3.out",
    }, 0);

    tl.to(titleEl, {
      opacity: 0.9,
      duration: 0.5,
      ease: "power2.out",
    }, 0);

    if (startBodyEl) {
      tl.to(startBodyEl, {
        opacity: 0.72,
        duration: 0.4,
        ease: "power2.out",
      }, 0.15);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Mode setup helpers — pure state configuration, no transitions.
  // ──────────────────────────────────────────────────────────────────
  function setupHome(skipIntro: boolean) {
    startPaneEl.style.display = "";
    startPaneEl.style.opacity = "";
    titleShrunk = false;

    currentSceneIndex = -1;
    scrollController.currentScene = 0;
    scrollController.setMode("travel");

    planetSystem.orbitGroup.visible = true;
    for (const p of planetSystem.planets) p.group.visible = false;
    planetSystem.aboutPlanet.group.visible = false;

    spaceship.group.visible = true;
    spaceship.lights.visible = true;
    updateSceneIndicator(-1);

    if (indicatorEl) indicatorEl.style.display = "";
    const spaceHint = document.getElementById("space-hint");
    if (spaceHint) spaceHint.style.display = "";

    configureShipOrbit();

    if (skipIntro) {
      spaceship.group.position.copy(SHIP_START_POSITION);
      titleEl.style.opacity = "0.9";
      titleEl.style.animation = "breathe 5s ease-in-out infinite";
      const startBodyEl = document.getElementById("start-body");
      if (startBodyEl) startBodyEl.style.opacity = "0.72";
      scrollController.isTransitioning = false;
    } else {
      playIntro();
    }
  }

  function setupAbout() {
    startPaneEl.style.display = "none";
    hideProjectInfo();

    planetSystem.orbitGroup.visible = false;
    setupPlanet(planetSystem.aboutPlanet, aboutProject, planetSystem.textures);
    planetSystem.aboutPlanet.group.position.copy(PLANET_POSITION);
    planetSystem.aboutPlanet.group.visible = true;

    spaceship.group.visible = false;
    spaceship.lights.visible = false;
    shipOrbit.disable();
    aboutShadow.style.display = "none";

    currentSceneIndex = ABOUT_SCENE_INDEX;
    scrollController.currentScene = ABOUT_SCENE_INDEX + 1;
    scrollController.isTransitioning = false;
    scrollController.setMode("view");

    // Ensure any residual tweens on the ship don't linger
    spaceship.group.position.copy(SHIP_POSITION);
    if (spaceship.model) spaceship.model.scale.setScalar(SHIP_SCALE);

    showAbout();
    updateSceneIndicator(ABOUT_SCENE_INDEX);
    orbitControls.enabled = false;

    const spaceHint = document.getElementById("space-hint");
    if (spaceHint) spaceHint.style.display = "none";
  }

  function setupGuestbook() {
    startPaneEl.style.display = "none";
    hideProjectInfo();
    hideAbout();
    aboutShadow.style.display = "none";

    planetSystem.orbitGroup.visible = false;
    planetSystem.aboutPlanet.group.visible = false;

    spaceship.group.visible = false;
    spaceship.lights.visible = false;
    shipOrbit.disable();

    scrollController.setMode("view");
    scrollController.isTransitioning = false;

    // Guestbook-specific camera: anchored at origin, looking slightly inward,
    // with mouse-driven parallax (handled in the render loop).
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -10);
    gbParallax.tx = 0;
    gbParallax.ty = 0;
    gbParallax.cx = 0;
    gbParallax.cy = 0;
    gbParallax.active = true;
    window.addEventListener("mousemove", onGuestbookMouseMove);

    if (indicatorEl) indicatorEl.style.display = "none";
    const spaceHint = document.getElementById("space-hint");
    if (spaceHint) spaceHint.style.display = "none";

    void mountGuestbook();
  }

  function teardownGuestbook() {
    gbParallax.active = false;
    window.removeEventListener("mousemove", onGuestbookMouseMove);
    unmountGuestbook();

    // Reset camera so next mode sees a clean pose
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
  }

  function teardownAbout() {
    hideAbout();
  }

  // ──────────────────────────────────────────────────────────────────
  // Public API — enterMode routes through a shared blur/unblur transition
  // for any mode-to-mode change. First call just sets up directly.
  // ──────────────────────────────────────────────────────────────────
  function runSetup(mode: SceneMode, skipIntro: boolean) {
    if (mode === "home") setupHome(skipIntro);
    else if (mode === "about") setupAbout();
    else if (mode === "guestbook") setupGuestbook();
  }

  function runTeardown(mode: SceneMode) {
    if (mode === "guestbook") teardownGuestbook();
    else if (mode === "about") teardownAbout();
    // home teardown: no listener cleanup needed; next setup replaces visibility
  }

  function enterMode(mode: SceneMode, opts: { skipIntro?: boolean } = {}) {
    const from = currentMode;
    if (from === mode) return;

    // First call (fresh page load) — skip transition, set up directly.
    if (from === null) {
      runSetup(mode, opts.skipIntro ?? false);
      currentMode = mode;
      return;
    }

    // Mode-to-mode change — shared blur transition (mirrors the old jumpToAbout
    // fade so every switch feels consistent).
    const blurProxy = { blur: 0 };
    gsap.killTweensOf([blurProxy, warpOverlay]);
    gsap.to(blurProxy, {
      blur: 12,
      duration: 0.25,
      ease: "power2.in",
      onUpdate() { canvas.style.filter = `blur(${blurProxy.blur}px)`; },
    });
    gsap.to(warpOverlay, { opacity: 0.6, duration: 0.25, ease: "power2.in" });

    gsap.delayedCall(0.3, () => {
      runTeardown(from);
      runSetup(mode, opts.skipIntro ?? false);
      currentMode = mode;

      gsap.to(blurProxy, {
        blur: 0,
        duration: 0.35,
        ease: "power2.out",
        onUpdate() {
          canvas.style.filter = blurProxy.blur < 0.5 ? "none" : `blur(${blurProxy.blur}px)`;
        },
      });
      gsap.to(warpOverlay, { opacity: 0, duration: 0.35, ease: "power2.out" });
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

    if (gbParallax.active) {
      gbParallax.cx += (gbParallax.tx - gbParallax.cx) * GUESTBOOK_PARALLAX_DAMPING;
      gbParallax.cy += (gbParallax.ty - gbParallax.cy) * GUESTBOOK_PARALLAX_DAMPING;
      camera.position.set(gbParallax.cx, gbParallax.cy, 0);
      camera.lookAt(0, 0, -10);
    } else if (!orbitControls.enabled) {
      shipOrbit.update();
    }

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

  void hidePlanet;

  return {
    enterMode,
    getMode: () => currentMode,
  };
}
