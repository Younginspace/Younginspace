import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import gsap from "gsap";
import {
  SHIP_START_X_ROTATION,
  SHIP_START_Y_ROTATION,
  SHIP_START_Z_ROTATION,
  SHIP_START_POSITION,
  SHIP_START_SCALE,
  SHIP_START_MODEL_OFFSET,
  SHIP_EXHAUST_POSITION,
} from "./scene-layout";

export interface Exhaust {
  group: THREE.Group;
  setIntensity: (v: number) => void;
  update: (t: number) => void;
}

export interface Spaceship {
  group: THREE.Group;
  lights: THREE.Group;
  model: THREE.Group | null;
  exhaust: Exhaust | null;
}

// --- GPU particle exhaust ---
// Strategy: THREE.Points with per-particle seed → cyclic life via time mod,
// shader-computed position = emitter + offset * spread + direction * travelDist * life.
// Color temperature gradient over life: white-hot → yellow → orange → red → fade.

// Ship bbox spans ~50 model units; engine at z=-25.5. Travel ~1/2 ship length.
const PARTICLE_COUNT = 180;         // fewer → more distinct grains
const PARTICLE_LIFETIME = 1.9;      // extend proportionally to keep apparent speed constant
const PARTICLE_TRAVEL = 20;         // +50% longer trail
const PARTICLE_BASE_SIZE = 1.5;     // fine grain
const PARTICLE_DIRECTION = new THREE.Vector3(0, 0, -1); // model-local: exit rear

const particleVert = /* glsl */ `
  attribute float aSeed;
  attribute vec3 aOffset;
  uniform float uTime;
  uniform vec3 uDirection;
  uniform float uSize;
  uniform float uTravelDist;
  uniform float uLifetime;
  uniform float uPixelRatio;
  varying float vLife;
  varying float vSeed;
  void main() {
    // Stagger particle phases so the stream is continuous
    float life = mod(uTime + aSeed * uLifetime, uLifetime) / uLifetime;
    vLife = life;
    vSeed = aSeed;
    // Lateral spread widens as particles travel (cone-shaped jet)
    float spread = 0.6 + life * 3.5;
    // Small pseudo-random drift so stream isn't perfectly rigid
    float drift = sin((aSeed + uTime) * 6.283) * 0.8 * life;
    vec3 pos = aOffset * spread
             + vec3(drift, drift * 0.7, 0.0)
             + uDirection * uTravelDist * life;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    // Per-particle size jitter (some grains bigger, some smaller)
    float sizeRand = 0.55 + 1.00 * fract(sin(aSeed * 13.37) * 78.91);
    // Shrink slightly over life
    float sizeScale = mix(1.25, 0.55, life);
    gl_PointSize = uSize * sizeScale * sizeRand * uPixelRatio * (300.0 / max(-mv.z, 0.1));
  }
`;

const particleFrag = /* glsl */ `
  uniform float uIntensity;
  varying float vLife;
  varying float vSeed;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    // Slightly sharper edge → more distinct "grain" per particle
    float soft = smoothstep(1.0, 0.15, d);
    soft = pow(soft, 1.1);

    // Blade Runner 2049: cold exhaust against warm dust background.
    // White-hot → ice blue → deep navy — maximum complementary contrast.
    vec3 whiteHot = vec3(0.96, 0.98, 1.00);
    vec3 iceBlue  = vec3(0.55, 0.85, 1.00);
    vec3 skyBlue  = vec3(0.20, 0.55, 1.00);
    vec3 deepBlue = vec3(0.06, 0.20, 0.60);
    vec3 navyDark = vec3(0.02, 0.05, 0.22);
    vec3 voidDark = vec3(0.01, 0.02, 0.08);
    vec3 col;
    if (vLife < 0.18) {
      col = mix(whiteHot, iceBlue, vLife / 0.18);
    } else if (vLife < 0.45) {
      col = mix(iceBlue, skyBlue, (vLife - 0.18) / 0.27);
    } else if (vLife < 0.70) {
      col = mix(skyBlue, deepBlue, (vLife - 0.45) / 0.25);
    } else if (vLife < 0.88) {
      col = mix(deepBlue, navyDark, (vLife - 0.70) / 0.18);
    } else {
      col = mix(navyDark, voidDark, (vLife - 0.88) / 0.12);
    }

    // Per-particle brightness jitter — narrower so peaks don't blow out
    float rand = fract(sin(vSeed * 91.7) * 43758.5);
    float jitter = 0.55 + 0.50 * rand;

    float alpha = soft * jitter;
    // Slower fade-in prevents a dense bright blob at the emitter
    alpha *= smoothstep(0.0, 0.18, vLife);
    // Fade-out pushed late so the layered tail (70-100%) is visible before dying out
    alpha *= 1.0 - smoothstep(0.80, 1.0, vLife);
    alpha *= uIntensity;
    gl_FragColor = vec4(col, alpha);
  }
`;

// Small always-visible core glow at the emitter nozzle
const coreVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const coreFrag = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c) * 2.0;
    float soft = smoothstep(1.0, 0.0, d);
    soft = pow(soft, 2.2);
    float flicker = 0.88 + 0.08 * sin(uTime * 22.0) + 0.04 * sin(uTime * 37.0);
    // Nozzle glow — Plan B: sky-blue edge → ice-white center (tiny hot spot)
    vec3 col = mix(vec3(0.20, 0.55, 1.00), vec3(0.96, 0.98, 1.00), soft);
    float a = soft * uIntensity * flicker;
    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a);
  }
`;

function createExhaust(): Exhaust {
  const group = new THREE.Group();
  group.position.copy(SHIP_EXHAUST_POSITION);

  // --- GPU particle stream ---
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3); // actual pos computed in shader
  const seeds = new Float32Array(PARTICLE_COUNT);
  const offsets = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    seeds[i] = Math.random();
    const angle = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.6) * 1.2; // biased toward center
    offsets[i * 3] = Math.cos(angle) * r;
    offsets[i * 3 + 1] = Math.sin(angle) * r;
    offsets[i * 3 + 2] = 0;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute("aOffset", new THREE.BufferAttribute(offsets, 3));

  const particleMat = new THREE.ShaderMaterial({
    vertexShader: particleVert,
    fragmentShader: particleFrag,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0.18 },
      uDirection: { value: PARTICLE_DIRECTION.clone() },
      uSize: { value: PARTICLE_BASE_SIZE },
      uTravelDist: { value: PARTICLE_TRAVEL },
      uLifetime: { value: PARTICLE_LIFETIME },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  });

  const points = new THREE.Points(geo, particleMat);
  points.renderOrder = 10;
  points.frustumCulled = false; // particles extend beyond geo bounding sphere
  group.add(points);

  // --- Hot core glow at nozzle (billboarded plane) ---
  const coreMat = new THREE.ShaderMaterial({
    vertexShader: coreVert,
    fragmentShader: coreFrag,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0.08 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  const coreGeo = new THREE.PlaneGeometry(1.0, 1.0);
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.renderOrder = 11;
  const _parentWQ = new THREE.Quaternion();
  core.onBeforeRender = (_r, _s, cam) => {
    if (core.parent) {
      core.parent.getWorldQuaternion(_parentWQ).invert();
      core.quaternion.copy(_parentWQ).multiply(cam.quaternion);
    } else {
      core.quaternion.copy(cam.quaternion);
    }
  };
  group.add(core);

  let targetIntensity = 0.18;
  const setIntensity = (v: number) => {
    targetIntensity = v;
  };

  const update = (t: number) => {
    const smooth = 0.08;
    const pCur = particleMat.uniforms.uIntensity.value as number;
    const cCur = coreMat.uniforms.uIntensity.value as number;
    particleMat.uniforms.uIntensity.value = pCur + (targetIntensity - pCur) * smooth;
    // Core glow stays dim — just a subtle nozzle hot-spot
    coreMat.uniforms.uIntensity.value = cCur + (targetIntensity * 0.7 - cCur) * smooth;
    particleMat.uniforms.uTime.value = t;
    coreMat.uniforms.uTime.value = t;
  };

  return { group, setIntensity, update };
}

// --- Debug mode: visualize ship local axes and tune exhaust position ---
function attachDebug(spaceship: Spaceship) {
  if (!spaceship.model) return;
  const model = spaceship.model;

  // Axes (cyan/magenta) showing model local frame — radius ~25 model units
  model.add(new THREE.AxesHelper(25));

  // Bounding box on main mesh to show ship extent
  model.traverse((o) => {
    if (o instanceof THREE.Mesh && o.visible && o.name.includes("Spaceship_0")) {
      const bh = new THREE.BoxHelper(o, 0x00ffff);
      model.add(bh);
    }
  });

  // Marker: big red sphere at current exhaust position (model local space)
  // radius 5 × ship scale (0.07–0.09) ≈ 0.35–0.45 world units → clearly visible
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(5, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xff0000,
      depthTest: false,
      transparent: true,
      opacity: 0.85,
    }),
  );
  marker.renderOrder = 9999;
  marker.position.copy(SHIP_EXHAUST_POSITION);
  model.add(marker);

  // White wireframe outline so marker is obvious against any background
  const outline = new THREE.Mesh(
    new THREE.SphereGeometry(5.3, 16, 16),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      depthTest: false,
    }),
  );
  outline.renderOrder = 9999;
  marker.add(outline);

  const step = 0.5;
  const handler = (e: KeyboardEvent) => {
    let moved = true;
    switch (e.key) {
      case "ArrowLeft":  marker.position.x -= step; break;
      case "ArrowRight": marker.position.x += step; break;
      case "ArrowUp":    marker.position.y += step; break;
      case "ArrowDown":  marker.position.y -= step; break;
      case "PageUp":     marker.position.z += step; break;
      case "PageDown":   marker.position.z -= step; break;
      default: moved = false;
    }
    if (moved) {
      e.preventDefault();
      // eslint-disable-next-line no-console
      console.log(
        `[debug:ship] exhaust local = (${marker.position.x.toFixed(2)}, ${marker.position.y.toFixed(2)}, ${marker.position.z.toFixed(2)})`,
      );
      // Move exhaust along with marker if exhaust is mounted
      if (spaceship.exhaust) {
        spaceship.exhaust.group.position.copy(marker.position);
      }
    }
  };
  window.addEventListener("keydown", handler);
  // eslint-disable-next-line no-console
  console.log(
    "%c[debug:ship] ACTIVE%c\n  Arrows = X/Y, PgUp/PgDn = Z, step 0.5\n  Start pos:",
    "color:#f33;font-weight:bold",
    "color:inherit",
    marker.position.toArray().map((n) => n.toFixed(2)).join(", "),
  );
}

export function createSpaceship(): Spaceship {
  const group = new THREE.Group();
  group.position.copy(SHIP_START_POSITION); // start centered, moves to SHIP_POSITION on first scroll

  const lights = new THREE.Group();

  const keyLight = new THREE.DirectionalLight(0xffeedd, 2.0);
  keyLight.position.set(4, 3, -2);
  lights.add(keyLight);

  const fillLight = new THREE.PointLight(0x665544, 0.8, 20);
  fillLight.position.set(-4, -1, -5);
  lights.add(fillLight);

  const rimLight = new THREE.PointLight(0x4488bb, 0.8, 15);
  rimLight.position.set(-1, 2, -1);
  lights.add(rimLight);

  const ambientLight = new THREE.AmbientLight(0x443322, 0.4);
  lights.add(ambientLight);

  // Idle drift — gentle sway
  gsap.to(group.rotation, {
    z: 0.012,
    duration: 5,
    yoyo: true,
    repeat: -1,
    ease: "sine.inOut",
  });

  const spaceship: Spaceship = { group, lights, model: null, exhaust: null };

  // Load GLB
  const loader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
  loader.setDRACOLoader(dracoLoader);

  loader.load(
    "/models/spaceship.glb",
    (gltf) => {
      const model = gltf.scene;

      // Center geometry at origin
      model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.name.includes("Spaceship_0")) {
          child.geometry.computeBoundingBox();
          const center = child.geometry.boundingBox!.getCenter(new THREE.Vector3());
          child.geometry.translate(-center.x, -center.y, -center.z);
        }
      });

      model.scale.setScalar(SHIP_START_SCALE);
      model.rotation.x = SHIP_START_X_ROTATION;
      model.rotation.y = SHIP_START_Y_ROTATION;
      model.rotation.z = SHIP_START_Z_ROTATION;
      model.position.copy(SHIP_START_MODEL_OFFSET);

      // Hide color variants, fix materials
      model.traverse((child) => {
        if (child.name.includes("Spaceship_1") || child.name.includes("Spaceship_2")) {
          child.visible = false;
          return;
        }
        if (child instanceof THREE.Mesh) {
          const mat = child.material;
          const fix = (m: THREE.Material) => {
            if (m instanceof THREE.MeshStandardMaterial) {
              m.envMapIntensity = 0.3;
              m.roughness = Math.max(m.roughness, 0.4);
              m.side = THREE.FrontSide;
              m.depthWrite = true;
            }
          };
          if (Array.isArray(mat)) mat.forEach(fix);
          else fix(mat);
        }
      });

      spaceship.model = model;
      group.add(model);

      // Attach exhaust in MODEL local space (rotates with model)
      const exhaust = createExhaust();
      spaceship.exhaust = exhaust;
      model.add(exhaust.group);

      // Debug mode ?debug=ship
      const params = new URLSearchParams(window.location.search);
      if (params.get("debug") === "ship") {
        attachDebug(spaceship);
        // Force exhaust to full brightness in debug mode so placement is visible
        spaceship.exhaust?.setIntensity(1.5);
      }
    },
    undefined,
    (error) => console.warn("Failed to load spaceship:", error),
  );

  return spaceship;
}

/** Flight vibration — always-on engine rumble on three axes + occasional bursts */
export function updateSpaceship(
  spaceship: Spaceship,
  _scrollSpeed: number,
  _delta: number,
) {
  if (!spaceship.group) return;
  const t = performance.now() * 0.001;

  // Always-on continuous engine rumble — gives the ship a constant "alive" feel
  const constY = Math.sin(t * 14.3) * 0.0012 + Math.sin(t * 22.7) * 0.0006;
  const constX = Math.sin(t * 9.1)  * 0.0008 + Math.sin(t * 16.5) * 0.0004;
  const constZ = Math.sin(t * 11.7) * 0.0006;

  // Stronger sporadic burst every ~3s (engine pulse / turbulence)
  const burst = Math.max(0, Math.sin(t * 1.1)) ** 8;
  const burstY = burst * Math.sin(t * 19) * 0.0014;
  const burstZ = burst * Math.sin(t * 17) * 0.0004;

  spaceship.group.position.y += constY + burstY;
  spaceship.group.position.x += constX;
  spaceship.group.position.z += constZ + burstZ;

  // Exhaust flicker + intensity smoothing
  if (spaceship.exhaust) {
    spaceship.exhaust.update(t);
  }
}
