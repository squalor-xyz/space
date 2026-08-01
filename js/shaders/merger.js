/**
 * Binary black-hole merger visualization — Squalor LLC / MPL-2.0
 * Artistic, time-compressed illustration — not a NR simulation.
 */

import { precisionHeader, hashNoise, fullscreenVert } from "./common.js";

export const vertexShader = fullscreenVert;

export const fragmentShader = `
${precisionHeader}
varying vec2 v_uv;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_progress;
uniform float u_brightness;
uniform float u_ring_intensity;

${hashNoise}

float ringProfile(float d, float r0, float w) {
  float x = (d - r0) / w;
  return exp(-x * x);
}

vec3 diskColor(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 cool = vec3(0.4, 0.1, 0.35);
  vec3 warm = vec3(1.0, 0.4, 0.1);
  vec3 hot = vec3(1.0, 0.9, 0.7);
  return mix(cool, mix(warm, hot, smoothstep(0.4, 1.0, t)), smoothstep(0.0, 1.0, t));
}

vec3 stars(vec2 p) {
  vec3 c = vec3(0.008, 0.01, 0.025);
  c += 0.03 * fbm(p * 1.2) * vec3(0.3, 0.35, 0.6);
  vec2 id = floor(p * 22.0);
  vec2 f = fract(p * 22.0) - 0.5;
  float n = hash21(id);
  float s = smoothstep(0.025, 0.0, length(f)) * step(0.93, n);
  c += s * vec3(0.85, 0.9, 1.0) * (0.5 + 0.5 * n);
  return c;
}

// Contribution from one BH: lensing sample + disk + ring
vec3 blackHole(vec2 p, vec2 center, float rs, float massTint, float phase) {
  vec2 d = p - center;
  float b = length(d);
  float eps = 1e-4;
  vec2 dir = d / max(b, eps);

  float deflect = (1.4 * rs) / max(b, eps);
  deflect = min(deflect, 2.2);
  vec2 lensed = d - dir * deflect * 0.5;

  float horizon = smoothstep(rs * 0.95, rs * 1.08, b);

  vec3 col = stars(lensed * 1.3 + center * 0.5 + vec2(phase * 0.01));
  col *= mix(0.2, 1.0, smoothstep(rs, rs * 3.5, b));

  // disk
  vec2 dp = vec2(lensed.x, lensed.y / 0.45);
  float r = length(dp);
  float ang = atan(dp.y, dp.x);
  float rIn = rs * 1.8;
  float rOut = rs * 6.5;

  if (r > rIn && r < rOut) {
    float omega = 1.0 / pow(max(r, rIn), 1.5);
    float swirl = ang + u_time * (0.8 + massTint) * omega * 2.0 + phase;
    float turb = fbm(vec2(swirl, r * 7.0));
    float radial = 1.0 - (r - rIn) / (rOut - rIn);
    float temp = pow(clamp(radial, 0.0, 1.0), 0.6);
    vec3 disk = diskColor(temp + turb * 0.15);
    float doppler = 1.0 + sin(ang) * 0.35;
    float br = pow(radial, 0.5) * u_brightness * doppler * (0.7 + 0.4 * turb);
    float alpha = smoothstep(rIn, rIn * 1.2, r) * smoothstep(rOut, rOut * 0.8, r) * horizon;
    col = mix(col, disk * br, clamp(alpha, 0.0, 0.95));
  }

  float bPh = rs * 1.5;
  float ring = ringProfile(b, bPh, rs * 0.05) + 0.3 * ringProfile(b, bPh * 1.15, rs * 0.08);
  col += vec3(0.85, 0.92, 1.0) * ring * u_ring_intensity * horizon;
  col += vec3(1.0, 0.65, 0.3) * exp(-pow((b - bPh) / (rs * 0.4), 2.0)) * 0.1 * u_ring_intensity;

  col *= horizon;
  col *= mix(0.0, 1.0, smoothstep(rs * 0.8, rs * 1.15, b));
  return col;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);

  float prog = clamp(u_progress, 0.0, 1.0);

  // Spiral-in path (compressed artistic timeline)
  float turns = 2.25;
  float amp = 0.42 * (1.0 - prog * 0.92);
  float theta = prog * turns * 6.2831853;
  // mass ratio ~ Andromeda larger
  float m1 = 1.0;   // MW-ish
  float m2 = 2.4;   // Andromeda-ish visual mass
  float w1 = m2 / (m1 + m2);
  float w2 = m1 / (m1 + m2);

  vec2 c1;
  vec2 c2;
  float rs1 = 0.055 * sqrt(m1);
  float rs2 = 0.055 * sqrt(m2);
  float merged = smoothstep(0.78, 0.92, prog);

  if (merged < 1.0) {
    c1 = vec2(cos(theta), sin(theta)) * amp * w1;
    c2 = vec2(cos(theta + 3.14159265), sin(theta + 3.14159265)) * amp * w2;
    // pull together near merger
    vec2 mid = (c1 * m1 + c2 * m2) / (m1 + m2);
    c1 = mix(c1, mid, merged);
    c2 = mix(c2, mid, merged);
  } else {
    c1 = vec2(0.0);
    c2 = vec2(0.0);
  }

  vec3 col;

  if (merged > 0.98) {
    float rsM = 0.055 * sqrt(m1 + m2) * (1.0 + 0.15 * sin(u_time * 3.0) * exp(-(prog - 0.9) * 20.0));
    // merger flare
    float flare = exp(-pow((prog - 0.88) * 18.0, 2.0)) * 1.8;
    col = blackHole(p, vec2(0.0), rsM, 1.5, 0.0);
    col += vec3(1.0, 0.85, 0.6) * flare * exp(-length(p) * 3.0);
  } else {
    vec3 a = blackHole(p, c1, rs1, 0.6, 0.0);
    vec3 b = blackHole(p, c2, rs2, 1.2, 1.7);
    // additive blend with slight max for overlapping glow
    col = a + b;
    // tidal glow bridge
    vec2 mid = 0.5 * (c1 + c2);
    float bridge = exp(-length(p - mid) * 4.0) * (1.0 - merged) * 0.15 * u_brightness;
    float sep = length(c1 - c2);
    bridge *= smoothstep(0.5, 0.1, sep);
    col += vec3(1.0, 0.5, 0.2) * bridge;
  }

  col = col / (1.0 + col * 0.7);
  col = pow(col, vec3(0.9));

  gl_FragColor = vec4(col, 1.0);
}
`;
