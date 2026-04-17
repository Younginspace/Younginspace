import * as THREE from "three";

/**
 * Star Nest by Pablo Roman Andrioli — MIT License
 * Adapted for Three.js fullscreen quad background.
 * Dimmed & desaturated so clickable project stars remain the focal point.
 */

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

// Star Nest — ported from Shadertoy, with tweaks:
//  - brightness turned way down (0.0008 vs 0.0015)
//  - saturation reduced (0.65 vs 0.85)
//  - final output multiplied by 0.4 for subtlety
//  - slow auto-rotation instead of mouse control
const fragmentShader = `
  uniform float iTime;
  uniform vec2 iResolution;
  uniform float uIntensity;  // global brightness multiplier (1.0 = default)
  uniform float uWarmth;     // amber tint strength (1.0 = default)
  uniform float uCoreGlow;   // ambient core strength (1.0 = default)
  uniform float uLift;       // deep-space color lift (1.0 = default)
  varying vec2 vUv;

  #define iterations 17
  #define formuparam 0.53
  #define volsteps 15
  #define stepsize 0.1

  #define zoom   0.800
  #define tile   0.850
  #define speed  0.004

  #define brightness 0.0008
  #define darkmatter 0.300
  #define distfading 0.730
  #define saturation 0.65

  void main() {
    vec2 uv = vUv - 0.5;
    uv.y *= iResolution.y / iResolution.x;
    vec3 dir = vec3(uv * zoom, 1.0);
    float time = iTime * speed + 0.25;

    // slow auto rotation
    float a1 = 0.5 + sin(iTime * 0.02) * 0.15;
    float a2 = 0.8 + cos(iTime * 0.015) * 0.1;
    mat2 rot1 = mat2(cos(a1), sin(a1), -sin(a1), cos(a1));
    mat2 rot2 = mat2(cos(a2), sin(a2), -sin(a2), cos(a2));
    dir.xz *= rot1;
    dir.xy *= rot2;

    vec3 from = vec3(1.0, 0.5, 0.5);
    from += vec3(time * 2.0, time, -2.0);
    from.xz *= rot1;
    from.xy *= rot2;

    // volumetric rendering
    float s = 0.1, fade = 1.0;
    vec3 v = vec3(0.0);
    for (int r = 0; r < volsteps; r++) {
      vec3 p = from + s * dir * 0.5;
      p = abs(vec3(tile) - mod(p, vec3(tile * 2.0)));
      float pa, a = pa = 0.0;
      for (int i = 0; i < iterations; i++) {
        p = abs(p) / dot(p, p) - formuparam;
        a += abs(length(p) - pa);
        pa = length(p);
      }
      float dm = max(0.0, darkmatter - a * a * 0.001);
      a *= a * a;
      if (r > 6) fade *= 1.0 - dm;
      v += fade;
      v += vec3(s, s * s, s * s * s * s) * a * brightness * fade;
      fade *= distfading;
      s += stepsize;
    }
    v = mix(vec3(length(v)), v, saturation);
    v *= 0.01 * 0.4;

    // Soft-clamp bright hot spots — exponential tonemap rolls off highlights
    // while preserving mid + dark tones, eliminating "starburst" pop artifacts.
    v = vec3(1.0) - exp(-v * 2.2);

    // Retro dust nebula: warm sepia-amber field with dusty variation.
    // Key: muted/dim warm tones so the bright white-hot exhaust core still pops.
    vec2 q = vUv * 2.0;
    float dustVar = sin(q.x * 2.6 + iTime * 0.03) * cos(q.y * 2.2 - iTime * 0.035);
    float dustMix = 0.5 + 0.5 * dustVar;

    vec3 ochreTint = vec3(1.00, 0.61, 0.26) * uWarmth;
    vec3 rustTint  = vec3(0.85, 0.38, 0.15) * uWarmth;
    vec3 nebTint = mix(rustTint, ochreTint, dustMix);
    v *= nebTint;

    // Radial glow: moderate warm ochre core, dim sienna edge
    float vignette = length(vUv - 0.5) * 1.4;
    vec3 ambientCore = vec3(0.15, 0.075, 0.022) * smoothstep(0.9, 0.0, vignette) * 0.50 * uCoreGlow;
    vec3 ambientEdge = vec3(0.035, 0.015, 0.006) * smoothstep(0.0, 1.0, vignette) * 0.38;
    v += ambientCore + ambientEdge;

    // Moderate sepia lift (tweakable)
    v += vec3(0.016, 0.008, 0.003) * uLift;

    // Global intensity applied last
    v *= uIntensity;

    gl_FragColor = vec4(v, 1.0);
  }
`;

export interface Nebula {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  update: (time: number) => void;
}

export function createNebula(): Nebula {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      iTime: { value: 0 },
      iResolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      uIntensity: { value: 0.74 },
      uWarmth:    { value: 1.42 },
      uCoreGlow:  { value: 0.34 },
      uLift:      { value: 0.94 },
    },
    depthWrite: false,
    depthTest: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "nebula";
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;

  const onResize = () => {
    material.uniforms.iResolution.value.set(
      window.innerWidth,
      window.innerHeight
    );
  };
  window.addEventListener("resize", onResize);

  return {
    mesh,
    material,
    update(time: number) {
      material.uniforms.iTime.value = time;
    },
  };
}
