import * as THREE from "three";
import { ProjectData } from "./data";
import {
  PLANET_RADIUS,
  PLANET_SEGMENTS,
  PLANET_POSITION,
  PLANET_OFFSCREEN_RIGHT,
} from "./scene-layout";

/**
 * Dual-buffer planet system.
 * Two planet groups (A and B) for smooth transitions.
 * Each has: textured sphere (rotates) + rim darkening shader.
 */

const textureLoader = new THREE.TextureLoader();

export interface PlanetInstance {
  group: THREE.Group;
  sphere: THREE.Mesh;
  rimLight: THREE.PointLight;
}

export interface PlanetSystem {
  sceneGroup: THREE.Group;
  planetA: PlanetInstance;
  planetB: PlanetInstance;
  sunLight: THREE.DirectionalLight;
  textures: Map<string, THREE.Texture>;
}

function createPlanetMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.65,
    metalness: 0.05,
  });

  // Inject rim darkening into the standard shader
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `
      // Rim darkening — planet edges fade to black
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
  sphere.rotation.x = 0.2; // slight axial tilt
  group.add(sphere);

  // Colored rim light per planet
  const rimLight = new THREE.PointLight(0xffffff, 0.5, 30);
  rimLight.position.set(-5, 2, 3);
  group.add(rimLight);

  group.visible = false;
  return { group, sphere, rimLight };
}

export function createPlanetSystem(projects: ProjectData[]): PlanetSystem {
  const sceneGroup = new THREE.Group();

  // Sun light — key directional light for half-shadow effect
  const sunLight = new THREE.DirectionalLight(0xffeedd, 2.0);
  sunLight.position.set(30, 10, 20);
  sceneGroup.add(sunLight);

  // Dim ambient
  const ambient = new THREE.AmbientLight(0x222233, 0.3);
  sceneGroup.add(ambient);

  // Pre-load all textures
  const textures = new Map<string, THREE.Texture>();
  for (const p of projects) {
    if (!textures.has(p.texture)) {
      const tex = textureLoader.load(p.texture);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      textures.set(p.texture, tex);
    }
  }

  const planetA = createPlanetInstance();
  const planetB = createPlanetInstance();
  sceneGroup.add(planetA.group);
  sceneGroup.add(planetB.group);

  return { sceneGroup, planetA, planetB, sunLight, textures };
}

export function preloadTexture(system: PlanetSystem, path: string) {
  if (!system.textures.has(path)) {
    const tex = textureLoader.load(path);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    system.textures.set(path, tex);
  }
}

export function setupPlanet(
  planet: PlanetInstance,
  project: ProjectData,
  textures: Map<string, THREE.Texture>,
) {
  const tex = textures.get(project.texture);
  const mat = planet.sphere.material as THREE.MeshStandardMaterial;
  mat.map = tex ?? null;
  mat.needsUpdate = true;

  planet.rimLight.color.set(project.glowColor);
  planet.group.position.copy(PLANET_POSITION);
  planet.group.visible = true;
}

export function hidePlanet(planet: PlanetInstance) {
  planet.group.visible = false;
  planet.group.position.z = PLANET_OFFSCREEN_RIGHT;
}

export function animatePlanets(system: PlanetSystem, delta: number) {
  if (system.planetA.group.visible) {
    system.planetA.sphere.rotation.y += delta * 0.08;
  }
  if (system.planetB.group.visible) {
    system.planetB.sphere.rotation.y += delta * 0.08;
  }
}
