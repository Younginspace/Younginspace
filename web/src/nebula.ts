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

    // warm color grade: shift toward dark amber/orange
    // tint the nebula with warm hues — more red/orange, less blue
    vec3 warmTint = vec3(1.15, 0.9, 0.65); // push R up, B down
    v *= warmTint;

    // add subtle warm radial glow from center
    float vignette = length(vUv - 0.5) * 1.4;
    // dark amber fog in mid-range, fading to deep blue at edges
    vec3 ambientWarm = vec3(0.12, 0.06, 0.02) * smoothstep(0.8, 0.0, vignette) * 0.35;
    vec3 ambientCool = vec3(0.02, 0.03, 0.06) * smoothstep(0.0, 1.0, vignette) * 0.2;
    v += ambientWarm + ambientCool;

    // slight overall lift so deep space isn't pure black
    v += vec3(0.012, 0.008, 0.005);

    gl_FragColor = vec4(v, 1.0);
  }
`;

export function createNebula(): {
  mesh: THREE.Mesh;
  update: (time: number) => void;
} {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      iTime: { value: 0 },
      iResolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
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
    update(time: number) {
      material.uniforms.iTime.value = time;
    },
  };
}
