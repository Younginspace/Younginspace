import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import gsap from "gsap";
import { projects } from "./data";
import { createCamera } from "./camera";
import { createPlanetSystem, setupPlanet, hidePlanet, animatePlanets, preloadTexture } from "./stars";
import { initProjectInfo, showProjectInfo, hideProjectInfo } from "./planet-text";
import { aboutProject, initAbout, showAbout } from "./about";
import { createStarfield, animateStarfield } from "./starfield";
import { createNebula } from "./nebula";
import { createSpaceship, updateSpaceship } from "./spaceship";
import { createScrollController } from "./scroll-controller";
import { createTransition } from "./scene-transition";
import {
  PLANET_POSITION,
  PLANET_OFFSCREEN_RIGHT,
  CAMERA_FOV,
  SHIP_POSITION,
  SHIP_SCALE,
  SHIP_START_POSITION,
  SHIP_START_SCALE,
  SHIP_INTRO_POSITION,
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

  // --- Main 3D scene ---
  const scene = new THREE.Scene();
  const camera = createCamera();

  // OrbitControls for view mode
  const orbitControls = new OrbitControls(camera, canvas);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.08;
  orbitControls.enabled = false;
  orbitControls.enablePan = false;
  orbitControls.enableZoom = false;
  orbitControls.rotateSpeed = 0.5;

  // Starfield
  const starfield = createStarfield();
  scene.add(starfield);

  // Planet system
  const planetSystem = createPlanetSystem(projects);
  preloadTexture(planetSystem, aboutProject.texture);
  scene.add(planetSystem.sceneGroup);

  // Spaceship (camera child — same pose in ALL scenes)
  const spaceship = createSpaceship();
  camera.add(spaceship.group);
  camera.add(spaceship.lights);
  scene.add(camera);

  // Project info overlay
  initProjectInfo();
  initAbout();

  // --- DOM references ---
  const titleEl = document.getElementById("title")!;
  const headerTitleEl = document.getElementById("header-title")!;
  const warpOverlay = document.getElementById("warp-overlay")!;

  // --- About shadow overlay (screen-space, rotation-proof) ---
  const aboutShadow = document.getElementById("about-shadow")!;

  // --- State ---
  const ABOUT_SCENE_INDEX = projects.length; // scene after all projects
  let currentSceneIndex = -1; // -1 = start, 0..N-1 = projects, N = about
  let useA = true;
  let titleShrunk = false;
  let viewModeAnimating = false;
  let shipDetached = false;

  function getCurrentPlanet() {
    return useA ? planetSystem.planetA : planetSystem.planetB;
  }
  function getNextPlanet() {
    return useA ? planetSystem.planetB : planetSystem.planetA;
  }

  // Start: no planet visible
  hidePlanet(planetSystem.planetA);
  hidePlanet(planetSystem.planetB);

  // --- Intro: start ship off-screen ---
  spaceship.group.position.copy(SHIP_INTRO_POSITION);

  // --- Scroll controller ---
  const totalScenes = projects.length + 1; // start + projects (about is nav-only)
  const scrollController = createScrollController(totalScenes);

  // --- Title management ---
  function shrinkTitle() {
    if (titleShrunk) return;
    titleShrunk = true;
    titleEl.style.opacity = "0";
    headerTitleEl.style.opacity = "1";
  }

  function expandTitle() {
    if (!titleShrunk) return;
    titleShrunk = false;
    titleEl.style.opacity = "0.9";
    headerTitleEl.style.opacity = "0";
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
    // Block scroll when on about scene
    if (currentSceneIndex === ABOUT_SCENE_INDEX) return;
    const nextIndex = currentSceneIndex + direction;
    if (nextIndex < -1 || nextIndex >= projects.length) return;
    if (scrollController.isTransitioning) return;

    scrollController.isTransitioning = true;

    // FROM start → first project: ship moves left + shrinks, planet slides in
    if (currentSceneIndex === -1 && direction === 1) {
      shrinkTitle();

      // Animate ship from center to left side
      gsap.to(spaceship.group.position, {
        x: SHIP_POSITION.x,
        y: SHIP_POSITION.y,
        z: SHIP_POSITION.z,
        duration: 1.0,
        ease: "power2.inOut",
      });
      if (spaceship.model) {
        gsap.to(spaceship.model.scale, {
          x: SHIP_SCALE, y: SHIP_SCALE, z: SHIP_SCALE,
          duration: 1.0,
          ease: "power2.inOut",
        });
      }

      // Planet slides in from right
      setupPlanet(getCurrentPlanet(), projects[0], planetSystem.textures);
      getCurrentPlanet().group.position.set(
        PLANET_OFFSCREEN_RIGHT,
        PLANET_POSITION.y,
        PLANET_POSITION.z,
      );
      getCurrentPlanet().group.visible = true;

      gsap.to(getCurrentPlanet().group.position, {
        x: PLANET_POSITION.x,
        y: PLANET_POSITION.y,
        z: PLANET_POSITION.z,
        duration: 1.0,
        ease: "power2.out",
        onComplete: () => {
          currentSceneIndex = 0;
          scrollController.currentScene = 1;
          scrollController.isTransitioning = false;
          showProjectInfo(projects[0]);
          updateSceneIndicator(0);
        },
      });
      return;
    }

    // FROM first project → back to start: ship returns to center, planet slides out
    if (currentSceneIndex === 0 && direction === -1) {
      hideProjectInfo();
      expandTitle();

      // Ship back to center + bigger
      gsap.to(spaceship.group.position, {
        x: SHIP_START_POSITION.x,
        y: SHIP_START_POSITION.y,
        z: SHIP_START_POSITION.z,
        duration: 0.8,
        ease: "power2.inOut",
      });
      if (spaceship.model) {
        gsap.to(spaceship.model.scale, {
          x: SHIP_START_SCALE, y: SHIP_START_SCALE, z: SHIP_START_SCALE,
          duration: 0.8,
          ease: "power2.inOut",
        });
      }

      // Planet slides out right
      gsap.to(getCurrentPlanet().group.position, {
        x: PLANET_OFFSCREEN_RIGHT,
        duration: 0.8,
        ease: "power2.in",
        onComplete: () => {
          hidePlanet(getCurrentPlanet());
          currentSceneIndex = -1;
          scrollController.currentScene = 0;
          scrollController.isTransitioning = false;
          updateSceneIndicator(-1);
        },
      });
      return;
    }

    // Project-to-project flyby transition
    hideProjectInfo();

    const tl = createTransition({
      currentPlanet: getCurrentPlanet(),
      nextPlanet: getNextPlanet(),
      starfield,
      nextProject: projects[nextIndex],
      setupPlanetFn: (planet, proj) => setupPlanet(planet, proj, planetSystem.textures),
      direction,
      canvas,
      warpOverlay,
      onComplete: () => {
        currentSceneIndex = nextIndex;
        scrollController.currentScene = nextIndex + 1;
        useA = !useA;
        scrollController.isTransitioning = false;
        showProjectInfo(projects[nextIndex]);
        updateSceneIndicator(nextIndex);
      },
    });

    tl.play();
  }

  scrollController.onSceneChange = handleSceneChange;

  // --- Ship detach/reattach for start view mode ---
  function detachShipToScene() {
    if (shipDetached) return;
    const worldPos = new THREE.Vector3();
    spaceship.group.getWorldPosition(worldPos);
    camera.remove(spaceship.group);
    scene.add(spaceship.group);
    spaceship.group.position.copy(worldPos);
    shipDetached = true;
  }

  function reattachShipToCamera() {
    if (!shipDetached) return;
    scene.remove(spaceship.group);
    camera.add(spaceship.group);
    spaceship.group.position.copy(SHIP_START_POSITION);
    if (spaceship.model) {
      spaceship.model.scale.setScalar(SHIP_START_SCALE);
    }
    shipDetached = false;
  }

  // --- View mode handling ---
  function enterViewMode() {
    if (viewModeAnimating) return;
    viewModeAnimating = true;

    if (currentSceneIndex < 0) {
      // Start page: detach ship, orbit around it
      detachShipToScene();
      const shipWorldPos = spaceship.group.position.clone();

      const lookProxy = { x: 0, y: 0, z: -5 };
      gsap.to(lookProxy, {
        x: shipWorldPos.x,
        y: shipWorldPos.y,
        z: shipWorldPos.z,
        duration: 0.4,
        ease: "power2.inOut",
        onUpdate() { camera.lookAt(lookProxy.x, lookProxy.y, lookProxy.z); },
        onComplete() {
          orbitControls.target.copy(shipWorldPos);
          orbitControls.enableZoom = true;
          orbitControls.minDistance = 1;
          orbitControls.maxDistance = 15;
          orbitControls.enabled = true;
          orbitControls.update();
          viewModeAnimating = false;
        },
      });
    } else {
      // Project/about page: planet is centered, seamless entry
      const isAbout = currentSceneIndex === ABOUT_SCENE_INDEX;
      orbitControls.target.set(0, 0, PLANET_POSITION.z);
      orbitControls.enableZoom = !isAbout;
      orbitControls.minDistance = 5;
      orbitControls.maxDistance = 30;
      orbitControls.enabled = true;
      orbitControls.update();
      viewModeAnimating = false;
    }
  }

  function exitViewMode() {
    if (viewModeAnimating) return;
    viewModeAnimating = true;
    orbitControls.enabled = false;

    const isStartPage = currentSceneIndex < 0;
    const startPos = camera.position.clone();

    const onDone = () => {
      camera.position.set(0, 0, 0);
      camera.lookAt(0, 0, -1);
      camera.fov = CAMERA_FOV;
      camera.updateProjectionMatrix();
      orbitControls.enableZoom = false;
      viewModeAnimating = false;
    };

    if (!isStartPage) {
      // Project page: arc interpolation around orbit center
      // to avoid the straight-line path passing close to the planet
      const orbitCenter = new THREE.Vector3(0, 0, PLANET_POSITION.z);
      const startOffset = startPos.clone().sub(orbitCenter);
      const endOffset = new THREE.Vector3(0, 0, 0).sub(orbitCenter);

      const startSph = new THREE.Spherical().setFromVector3(startOffset);
      const endSph = new THREE.Spherical().setFromVector3(endOffset);

      const proxy = { t: 0 };
      gsap.to(proxy, {
        t: 1,
        duration: 0.6,
        ease: "power2.inOut",
        onUpdate() {
          const sph = new THREE.Spherical(
            THREE.MathUtils.lerp(startSph.radius, endSph.radius, proxy.t),
            THREE.MathUtils.lerp(startSph.phi, endSph.phi, proxy.t),
            THREE.MathUtils.lerp(startSph.theta, endSph.theta, proxy.t),
          );
          camera.position.setFromSpherical(sph).add(orbitCenter);
          camera.lookAt(orbitCenter);
        },
        onComplete: onDone,
      });
    } else {
      // Start page: arc interpolation around ship (same pattern as project page)
      // Ship is fixed at center — camera only rotates + zooms around it
      const orbitCenter = spaceship.group.position.clone();
      const startOffset = startPos.clone().sub(orbitCenter);
      const endOffset = new THREE.Vector3(0, 0, 0).sub(orbitCenter);

      const startSph = new THREE.Spherical().setFromVector3(startOffset);
      const endSph = new THREE.Spherical().setFromVector3(endOffset);

      const proxy = { t: 0 };
      gsap.to(proxy, {
        t: 1,
        duration: 0.6,
        ease: "power2.inOut",
        onUpdate() {
          const sph = new THREE.Spherical(
            THREE.MathUtils.lerp(startSph.radius, endSph.radius, proxy.t),
            THREE.MathUtils.lerp(startSph.phi, endSph.phi, proxy.t),
            THREE.MathUtils.lerp(startSph.theta, endSph.theta, proxy.t),
          );
          camera.position.setFromSpherical(sph).add(orbitCenter);
          camera.lookAt(orbitCenter);
        },
        onComplete() {
          reattachShipToCamera();
          onDone();
        },
      });
    }
  }

  scrollController.onModeChange = (mode) => {
    // About scene: always view mode, no travel mode
    if (currentSceneIndex === ABOUT_SCENE_INDEX) return;
    if (mode === "view") enterViewMode();
    else exitViewMode();
  };

  // View mode zoom is handled by OrbitControls (dolly zoom) for both start + project pages

  // --- Jump to about (from nav link) ---
  function jumpToAbout() {
    if (currentSceneIndex === ABOUT_SCENE_INDEX) return;
    if (scrollController.isTransitioning) return;
    scrollController.isTransitioning = true;

    // Hide current content
    if (currentSceneIndex >= 0 && currentSceneIndex < projects.length) {
      hideProjectInfo();
    }

    // Warp out
    const blurProxy = { blur: 0 };
    gsap.to(blurProxy, {
      blur: 12,
      duration: 0.25,
      ease: "power2.in",
      onUpdate() { canvas.style.filter = `blur(${blurProxy.blur}px)`; },
    });
    gsap.to(warpOverlay, { opacity: 0.6, duration: 0.25, ease: "power2.in" });

    gsap.delayedCall(0.3, () => {
      // Teleport: move ship if coming from start
      if (currentSceneIndex === -1) {
        shrinkTitle();
        spaceship.group.position.copy(SHIP_POSITION);
        if (spaceship.model) spaceship.model.scale.setScalar(SHIP_SCALE);
      }

      // Swap planets
      hidePlanet(getCurrentPlanet());
      hidePlanet(getNextPlanet());

      setupPlanet(getCurrentPlanet(), aboutProject, planetSystem.textures);
      getCurrentPlanet().group.position.copy(PLANET_POSITION);
      getCurrentPlanet().group.visible = true;

      // Screen-space shadow
      aboutShadow.style.display = "block";
      aboutShadow.style.opacity = "1";

      // Warp in
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

      // About: auto-enter view mode (rotate only, no zoom), hide hints
      orbitControls.target.set(0, 0, PLANET_POSITION.z);
      orbitControls.enableZoom = false;
      orbitControls.enabled = true;
      orbitControls.update();
      scrollController.mode = "view";
      const scrollHint = document.getElementById("scroll-hint");
      const spaceHint = document.getElementById("space-hint");
      if (scrollHint) scrollHint.style.display = "none";
      if (spaceHint) spaceHint.style.display = "none";

      // Enable header title as home link
      headerTitleEl.style.pointerEvents = "auto";
      headerTitleEl.style.cursor = "pointer";
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

  // --- Intro fly-in animation ---
  const scrollHintEl = document.getElementById("scroll-hint");
  scrollController.isTransitioning = true; // block scroll during intro

  const introTl = gsap.timeline({
    onComplete() {
      scrollController.isTransitioning = false;
      // Start the breathing animation on the title after intro
      titleEl.style.animation = "breathe 5s ease-in-out infinite";
    },
  });

  // Ship flies from off-screen to start position (fast→slow)
  introTl.to(spaceship.group.position, {
    x: SHIP_START_POSITION.x,
    y: SHIP_START_POSITION.y,
    z: SHIP_START_POSITION.z,
    duration: 2.4,
    ease: "power3.out",
  }, 0);

  // Title fades in when ship is near its destination
  introTl.to(titleEl, {
    opacity: 0.9,
    duration: 1.2,
    ease: "power2.out",
  }, 1.4);

  // Scroll hint fades in after everything settles
  if (scrollHintEl) {
    introTl.to(scrollHintEl, {
      opacity: 0.55,
      duration: 0.8,
      ease: "power2.out",
      onComplete() {
        scrollHintEl!.style.opacity = "";
        scrollHintEl!.classList.add("intro-done");
      },
    }, 2.2);
  }

  return { jumpToAbout };
}
