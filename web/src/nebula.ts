import * as THREE from "three";

/**
 * Star Nest by Pablo Roman Andrioli — MIT License
 * Adapted for Three.js fullscreen quad background.
 * Dimmed & desaturated so clickable project stars remain the focal point.
 *
 * Tunable uniforms (see `?debug=nebula` panel):
 *   - uIntensity:   global brightness multiplier
 *   - uWarmth:      tint strength on highlights/shadows
 *   - uCoreGlow:    radial core glow strength
 *   - uLift:        sepia lift in deep-space dark regions
 *   - uSaturation:  mix between greyscale and full color
 *   - uOchre / uRust / uCore / uEdge: individual color stops
 */

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float iTime;
  uniform vec2 iResolution;
  uniform float uIntensity;
  uniform float uWarmth;
  uniform float uCoreGlow;
  uniform float uLift;
  uniform float uSaturation;
  uniform vec3 uOchre;   // warm highlight tint
  uniform vec3 uRust;    // warm shadow tint
  uniform vec3 uCore;    // center radial glow
  uniform vec3 uEdge;    // outer vignette glow
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
    v = mix(vec3(length(v)), v, uSaturation);
    v *= 0.01 * 0.4;

    // Soft-clamp bright hot spots
    v = vec3(1.0) - exp(-v * 2.2);

    // Dust nebula tint — blend highlight (ochre) and shadow (rust) across the field
    vec2 q = vUv * 2.0;
    float dustVar = sin(q.x * 2.6 + iTime * 0.03) * cos(q.y * 2.2 - iTime * 0.035);
    float dustMix = 0.5 + 0.5 * dustVar;

    vec3 highlightTint = uOchre * uWarmth;
    vec3 shadowTint    = uRust  * uWarmth;
    vec3 nebTint = mix(shadowTint, highlightTint, dustMix);
    v *= nebTint;

    // Radial glow
    float vignette = length(vUv - 0.5) * 1.4;
    vec3 ambientCore = uCore * smoothstep(0.9, 0.0, vignette) * 0.50 * uCoreGlow;
    vec3 ambientEdge = uEdge * smoothstep(0.0, 1.0, vignette) * 0.38;
    v += ambientCore + ambientEdge;

    // Sepia lift
    v += vec3(0.016, 0.008, 0.003) * uLift;

    // Global intensity
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
      // Retro-elegant warm-dust palette, tuned against the ship's cold blue
      // exhaust (see spaceship.ts — "Blade Runner 2049 cold-vs-warm").
      // Locked in via ?debug=nebula panel.
      uIntensity:  { value: 1.59 },
      uWarmth:     { value: 1.56 },
      uCoreGlow:   { value: 0.66 },
      uLift:       { value: 1.04 },
      uSaturation: { value: 0.39 },
      uOchre:      { value: new THREE.Color(0xe8a474) }, // dusty peach amber (highlights)
      uRust:       { value: new THREE.Color(0x944a35) }, // burnt sienna / terracotta (shadows)
      uCore:       { value: new THREE.Color(0x1a0f05) }, // deep warm brown (core glow)
      uEdge:       { value: new THREE.Color(0x060302) }, // warm near-black (edge)
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
