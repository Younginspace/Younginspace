import * as THREE from "three";
import { ProjectData } from "./data";
import {
  PLANET_RADIUS,
  PLANET_SEGMENTS,
  PLANET_POSITION,
  getPlanetOrbitPos,
} from "./scene-layout";

/**
 * Orbit-based planet system.
 * All project planets live at fixed slots along the orbit line (inside orbitGroup).
 * Perspective naturally makes distant planets appear smaller.
 * A separate "about" planet sits outside the orbit, shown only on jumpToAbout.
 */

const textureLoader = new THREE.TextureLoader();

export interface PlanetInstance {
  group: THREE.Group;
  sphere: THREE.Mesh;
  rimLight: THREE.PointLight;
}

export interface PlanetSystem {
  /** Parent group containing all project planets — its position animates during transitions. */
  orbitGroup: THREE.Group;
  /** Container for the about planet (separate from orbit). */
  aboutRoot: THREE.Group;
  /** Project planets indexed by project.order (0..N-1). */
  planets: PlanetInstance[];
  /** Dedicated planet for the about scene. */
  aboutPlanet: PlanetInstance;
  sunLight: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  textures: Map<string, THREE.Texture>;
}

function createPlanetMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.65,
    metalness: 0.05,
    transparent: true, // enables opacity fade during transitions
  });

  // Rim darkening — planet edges fade to black
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `
      vec3 viewDir = normalize(vViewPosition);
      float rimDot = max(0.0, dot(normalize(vNormal), viewDir));
      float rimFade = smoothstep(0.0, 0.5, rimDot);
      gl_FragColor.rgb *= rimFade;
      #include <dithering_fragment>
      `,
    );
  };

  return material;
}

function createPlanetInstance(): PlanetInstance {
  const group = new THREE.Group();

  const geometry = new THREE.SphereGeometry(PLANET_RADIUS, PLANET_SEGMENTS, PLANET_SEGMENTS);
  const material = createPlanetMaterial();
  const sphere = new THREE.Mesh(geometry, material);
  sphere.rotation.x = 0.2;
  group.add(sphere);

  // Colored rim light per planet
  const rimLight = new THREE.PointLight(0xffffff, 0.5, 30);
  rimLight.position.set(-5, 2, 3);
  group.add(rimLight);

  return { group, sphere, rimLight };
}

/** Configure a planet with project data and make it visible. */
function applyProject(
  planet: PlanetInstance,
  project: ProjectData,
  textures: Map<string, THREE.Texture>,
) {
  const tex = textures.get(project.texture);
  const mat = planet.sphere.material as THREE.MeshStandardMaterial;
  mat.map = tex ?? null;
  mat.needsUpdate = true;
  planet.rimLight.color.set(project.glowColor);
}

export function createPlanetSystem(projects: ProjectData[]): PlanetSystem {
  // orbitGroup animates (position shifts) during scene transitions
  const orbitGroup = new THREE.Group();

  // aboutRoot is separate so it's not affected by orbit shifts
  const aboutRoot = new THREE.Group();

  // Sun light — shared directional light for all planets
  const sunLight = new THREE.DirectionalLight(0xffeedd, 2.0);
  sunLight.position.set(30, 10, 20);
  orbitGroup.add(sunLight);
  // Light in aboutRoot — positioned to cast a strong shadow on the RIGHT side of the moon
  const aboutSun = new THREE.DirectionalLight(0xffeedd, 2.2);
  aboutSun.position.set(-30, 8, 18); // sun to the left → unlit (shadow) side faces +X (screen right)
  aboutRoot.add(aboutSun);

  const ambient = new THREE.AmbientLight(0x222233, 0.3);
  orbitGroup.add(ambient);
  // Dimmer ambient on about so the shadow is more dramatic
  aboutRoot.add(new THREE.AmbientLight(0x221a15, 0.15));

  // Pre-load textures for all projects (including about, caller may preload)
  const textures = new Map<string, THREE.Texture>();
  for (const p of projects) {
    if (!textures.has(p.texture)) {
      const tex = textureLoader.load(p.texture);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      textures.set(p.texture, tex);
    }
  }

  // Create one planet per project, positioned along the orbit
  const planets: PlanetInstance[] = [];
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    const planet = createPlanetInstance();
    planet.group.position.copy(getPlanetOrbitPos(i));
    applyProject(planet, project, textures);
    planet.group.visible = true;
    orbitGroup.add(planet.group);
    planets.push(planet);
  }

  // About planet — initially hidden, positioned at PLANET_POSITION
  const aboutPlanet = createPlanetInstance();
  aboutPlanet.group.position.copy(PLANET_POSITION);
  aboutPlanet.group.visible = false;
  aboutRoot.add(aboutPlanet.group);

  return {
    orbitGroup,
    aboutRoot,
    planets,
    aboutPlanet,
    sunLight,
    ambient,
    textures,
  };
}

export function preloadTexture(system: PlanetSystem, path: string) {
  if (!system.textures.has(path)) {
    const tex = textureLoader.load(path);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    system.textures.set(path, tex);
  }
}

/** Apply a project to a planet (used for the about planet on jumpToAbout). */
export function setupPlanet(
  planet: PlanetInstance,
  project: ProjectData,
  textures: Map<string, THREE.Texture>,
) {
  applyProject(planet, project, textures);
  planet.group.visible = true;
}

export function hidePlanet(planet: PlanetInstance) {
  planet.group.visible = false;
}

export function animatePlanets(system: PlanetSystem, delta: number) {
  for (const p of system.planets) {
    if (p.group.visible) p.sphere.rotation.y += delta * 0.08;
  }
  if (system.aboutPlanet.group.visible) {
    system.aboutPlanet.sphere.rotation.y += delta * 0.08;
  }
}
