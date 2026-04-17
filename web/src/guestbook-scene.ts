import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createStarfield, animateStarfield } from "./starfield";
import { createNebula } from "./nebula";

/**
 * Standalone Three.js scene for the /guestbook page.
 * Radar dish on barren desert ground, dynamic nebula sky,
 * mountain silhouettes at horizon, floating dust particles.
 */
export function initGuestbookScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000);
  renderer.autoClear = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  // ─── Nebula background (reuse from main page) ─────────
  const nebulaScene = new THREE.Scene();
  const nebulaCam = new THREE.Camera();
  const nebula = createNebula();
  nebulaScene.add(nebula.mesh);

  // ─── Main scene ───────────────────────────────────────
  const scene = new THREE.Scene();

  // Camera — low angle, slightly looking up for dramatic perspective
  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    500,
  );
  camera.position.set(3, -2.5, 2);

  // Radar sits left — closer and bigger so it fills the left side
  const radarCenter = new THREE.Vector3(-6, -1, -10);
  const groundY = radarCenter.y - 4; // -5

  // OrbitControls — look slightly above radar center
  const orbitControls = new OrbitControls(camera, canvas);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.08;
  orbitControls.enablePan = false;
  orbitControls.enableZoom = false;
  orbitControls.rotateSpeed = 0.4;
  orbitControls.target.set(radarCenter.x + 1, radarCenter.y + 2, radarCenter.z);
  orbitControls.update();

  const textureLoader = new THREE.TextureLoader();

  // ─── Starfield ────────────────────────────────────────
  const starfield = createStarfield();
  scene.add(starfield);

  // ─── Ground plane — desert texture ────────────────────
  const groundTexture = textureLoader.load("/textures/desert-ground.jpg");
  groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(40, 40);
  groundTexture.colorSpace = THREE.SRGBColorSpace;

  const groundGeo = new THREE.PlaneGeometry(300, 300);
  const groundMat = new THREE.MeshStandardMaterial({
    map: groundTexture,
    roughness: 0.95,
    metalness: 0.0,
    color: 0x776655, // warm-darken the texture
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(radarCenter.x, groundY, radarCenter.z);
  scene.add(ground);

  // ─── Mountain silhouettes — procedural ring ───────────
  const mountains = createMountainRing(radarCenter.x, groundY, radarCenter.z);
  scene.add(mountains);

  // ─── Fog — warm dark, dissolves ground edges ──────────
  scene.fog = new THREE.FogExp2(0x0a0806, 0.014);

  // ─── Lighting ─────────────────────────────────────────
  const moonLight = new THREE.DirectionalLight(0xddeeff, 3.0);
  moonLight.position.set(-10, 20, 15);
  scene.add(moonLight);

  const fillLight = new THREE.DirectionalLight(0xffeedd, 1.2);
  fillLight.position.set(15, 5, 10);
  scene.add(fillLight);

  const ambient = new THREE.AmbientLight(0x333344, 0.8);
  scene.add(ambient);

  // Cyan accent on the dish
  const accentLight = new THREE.PointLight(0x4fc3f7, 1.5, 30);
  accentLight.position.set(
    radarCenter.x,
    radarCenter.y + 6,
    radarCenter.z + 5,
  );
  scene.add(accentLight);

  // ─── Dust particles ───────────────────────────────────
  const dust = createDustParticles(radarCenter, groundY);
  scene.add(dust);

  // ─── Radar model ──────────────────────────────────────
  const loader = new GLTFLoader();
  const radarPivot = new THREE.Group();
  radarPivot.position.copy(radarCenter);
  scene.add(radarPivot);

  loader.load(
    "/models/radar.glb",
    (gltf) => {
      const model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 8 / maxDim; // slightly bigger than before

      model.scale.setScalar(scale);
      model.position.set(
        -center.x * scale,
        -box.min.y * scale,
        -center.z * scale,
      );

      model.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.material instanceof THREE.MeshStandardMaterial
        ) {
          child.material.envMapIntensity = 0.3;
          child.material.roughness = Math.max(child.material.roughness, 0.3);
        }
      });

      radarPivot.add(model);
    },
    undefined,
    (error) => console.warn("Failed to load radar model:", error),
  );

  // Prevent wheel scroll
  canvas.addEventListener("wheel", (e) => e.preventDefault(), {
    passive: false,
  });

  // Resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ─── Render loop ──────────────────────────────────────
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    // Slow horizontal sweep
    radarPivot.rotation.y += delta * 0.08;

    // Gentle dust drift
    dust.rotation.y = Math.sin(elapsed * 0.04) * 0.08;
    dust.position.x = Math.sin(elapsed * 0.07) * 0.4;
    dust.position.z = Math.cos(elapsed * 0.05) * 0.3;

    animateStarfield(starfield, delta);
    nebula.update(elapsed);
    orbitControls.update();

    // Two-pass: nebula background → main scene
    renderer.clear();
    renderer.render(nebulaScene, nebulaCam);
    renderer.clearDepth();
    renderer.render(scene, camera);
  }

  animate();
}

/** Procedural mountain silhouette ring around the horizon */
function createMountainRing(
  cx: number,
  groundY: number,
  cz: number,
): THREE.Mesh {
  const radius = 110;
  const segments = 96;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = cx + Math.cos(angle) * radius;
    const z = cz + Math.sin(angle) * radius;

    // Multi-frequency sine waves → mountain-like ridge profile
    const h =
      5 +
      Math.sin(angle * 3.7 + 1.2) * 3.5 +
      Math.sin(angle * 7.3 + 0.5) * 2.2 +
      Math.sin(angle * 13.1 + 2.8) * 1.3 +
      Math.sin(angle * 21.7) * 0.7;
    const peakY = groundY + Math.max(h, 0.5);

    // bottom vertex
    positions.push(x, groundY - 1, z);
    // top vertex (peak)
    positions.push(x, peakY, z);

    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshBasicMaterial({
    color: 0x060606,
    side: THREE.DoubleSide,
    fog: true,
  });

  return new THREE.Mesh(geo, mat);
}

/** Floating dust / sand particles near ground level */
function createDustParticles(
  center: THREE.Vector3,
  groundY: number,
): THREE.Points {
  const count = 400;
  const positions = new Float32Array(count * 3);
  const spread = 50;

  for (let i = 0; i < count; i++) {
    positions[i * 3] = center.x + (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = groundY + Math.random() * 10;
    positions[i * 3 + 2] = center.z + (Math.random() - 0.5) * spread;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xccbbaa,
    size: 0.12,
    transparent: true,
    opacity: 0.2,
    fog: true,
    sizeAttenuation: true,
    depthWrite: false,
  });

  return new THREE.Points(geo, mat);
}
