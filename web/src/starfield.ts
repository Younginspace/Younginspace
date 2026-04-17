import * as THREE from "three";

const STAR_COUNT = 2000;
const SPREAD_XY = 50;
const SPREAD_Z = 150;

const warpVertexShader = `
  attribute float alpha;
  uniform float warpFactor;
  varying float vAlpha;
  varying float vStretch;

  void main() {
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float baseDist = -mvPosition.z;
    float baseSize = 1.5 * (80.0 / max(baseDist, 1.0));
    vStretch = warpFactor;
    gl_PointSize = baseSize + warpFactor * 15.0;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const warpFragmentShader = `
  varying float vAlpha;
  varying float vStretch;

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    // When warping, stretch into ellipse (taller)
    float aspect = 1.0 + vStretch * 6.0;
    float dist = length(vec2(p.x * aspect, p.y));
    float a = smoothstep(0.5, 0.05, dist) * vAlpha * (0.4 + vStretch * 0.6);
    // Plan B: amber bg → cool white-blue stars for complementary pop
    float starHue = fract(vAlpha * 7.31);
    vec3 hotWhite  = vec3(0.98, 0.99, 1.00);
    vec3 coolBlue  = vec3(0.75, 0.88, 1.00);
    vec3 idleColor = mix(hotWhite, coolBlue, starHue * 0.5);
    vec3 warpColor = vec3(0.85, 0.95, 1.00); // cool streaks during warp
    vec3 color = mix(idleColor, warpColor, vStretch);
    gl_FragColor = vec4(color, a);
  }
`;

export function createStarfield(): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(STAR_COUNT * 3);
  const alphas = new Float32Array(STAR_COUNT);

  for (let i = 0; i < STAR_COUNT; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * SPREAD_XY * 2;
    positions[i3 + 1] = (Math.random() - 0.5) * SPREAD_XY * 2;
    positions[i3 + 2] = (Math.random() - 0.5) * SPREAD_Z * 2;
    alphas[i] = 0.15 + Math.random() * 0.4;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("alpha", new THREE.BufferAttribute(alphas, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: warpVertexShader,
    fragmentShader: warpFragmentShader,
    uniforms: {
      warpFactor: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.name = "starfield";
  return points;
}

/** Reposition starfield around camera so it feels infinite */
export function updateStarfieldWarp(
  starfield: THREE.Points,
  scrollSpeed: number,
  camera: THREE.PerspectiveCamera,
) {
  // Move starfield center to follow camera Z
  starfield.position.z = camera.position.z;

  // Warp factor: 0 = normal, 1 = full streaks
  const warp = Math.min(1, scrollSpeed * 12);
  const mat = starfield.material as THREE.ShaderMaterial;
  // Smooth transition
  mat.uniforms.warpFactor.value += (warp - mat.uniforms.warpFactor.value) * 0.1;
}

export function animateStarfield(starfield: THREE.Points, delta: number) {
  starfield.rotation.y += delta * 0.003;
  starfield.rotation.x += delta * 0.001;
}
