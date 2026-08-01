/**
 * Sagittarius A* visualization shaders — Squalor LLC / MPL-2.0
 * Artistic real-time approximation, not a GR integrator.
 */

import { precisionHeader, hashNoise, fullscreenVert } from "./common.js";

export const vertexShader = fullscreenVert;

export const fragmentShader = `
${precisionHeader}
varying vec2 v_uv;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_disk_brightness;
uniform float u_rotation;
uniform float u_doppler;
uniform float u_ring_intensity;
uniform float u_jet_intensity;
uniform float u_inclination;

${hashNoise}

// Soft photon-ring profile around impact parameter b0
float ringProfile(float b, float b0, float width) {
  float x = (b - b0) / width;
  return exp(-x * x);
}

// Approximate temperature → color for thin disk
vec3 diskTemperatureColor(float t) {
  t = clamp(t, 0.0, 1.0);
  // cool outer → warm mid → hot inner (yellow-white)
  vec3 cool = vec3(0.55, 0.12, 0.04);
  vec3 warm = vec3(1.0, 0.45, 0.12);
  vec3 hot = vec3(1.0, 0.92, 0.75);
  if (t < 0.45) {
    return mix(cool, warm, t / 0.45);
  }
  return mix(warm, hot, (t - 0.45) / 0.55);
}

// Procedural starfield in aspect-correct coords
vec3 starfield(vec2 p) {
  vec3 col = vec3(0.01, 0.012, 0.03);
  // faint milky haze
  col += vec3(0.02, 0.025, 0.05) * fbm(p * 1.5 + 3.0);

  // sparse bright stars via cell noise
  vec2 gv = fract(p * 18.0) - 0.5;
  vec2 id = floor(p * 18.0);
  float n = hash21(id);
  float d = length(gv - vec2(n - 0.5, hash21(id + 17.0) - 0.5) * 0.35);
  float star = smoothstep(0.03, 0.0, d);
  star *= step(0.92, n);
  float twinkle = 0.7 + 0.3 * sin(u_time * (1.0 + n * 3.0) + n * 20.0);
  col += vec3(0.9, 0.95, 1.0) * star * twinkle * (0.5 + 0.5 * n);

  // dimmer layer
  vec2 gv2 = fract(p * 42.0) - 0.5;
  vec2 id2 = floor(p * 42.0);
  float n2 = hash21(id2 + 3.1);
  float d2 = length(gv2);
  float star2 = smoothstep(0.02, 0.0, d2) * step(0.97, n2);
  col += vec3(0.6) * star2 * 0.4;

  return col;
}

void main() {
  vec2 uv = v_uv;
  // aspect-correct centered coords
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);

  float rs = 0.12; // visual Schwarzschild-ish scale
  float b = length(p);
  float eps = 1e-4;

  // Schwarzschild-inspired deflection of background / sampling coords
  // Stronger near the photon sphere (~1.5 rs), soft falloff outside
  float deflect = (1.5 * rs) / max(b, eps);
  deflect = min(deflect, 2.5);
  vec2 dir = p / max(b, eps);
  vec2 lensed = p - dir * deflect * 0.55;

  // Horizon mask (slightly soft edge)
  float horizon = smoothstep(rs * 0.98, rs * 1.05, b);

  // Background through lens
  vec3 bg = starfield(lensed * 1.4 + vec2(0.0, u_time * 0.002));
  // dim stars near BH for contrast
  bg *= mix(0.15, 1.0, smoothstep(rs, rs * 4.0, b));

  vec3 color = bg;

  // ---- Thin accretion disk (inclined ellipse in screen space) ----
  float inc = clamp(u_inclination, 0.15, 0.85);
  // squash Y for inclination
  vec2 dp = vec2(lensed.x, lensed.y / max(inc, 0.2));
  float r = length(dp);
  float angle = atan(dp.y, dp.x);

  float rIn = rs * 1.85;
  float rOut = rs * 7.5;

  if (r > rIn && r < rOut && abs(lensed.y) < rOut * 0.85) {
    // Kepler-ish swirl
    float omega = 1.0 / pow(max(r, rIn), 1.5);
    float swirl = angle + u_time * u_rotation * omega * 2.2;

    float turb = fbm(vec2(swirl * 1.5, r * 8.0 - u_time * u_rotation * 0.4));
    float radial = 1.0 - (r - rIn) / (rOut - rIn);
    float temp = pow(clamp(radial, 0.0, 1.0), 0.65);
    temp = mix(temp, temp * (0.75 + 0.5 * turb), 0.45);

    vec3 disk = diskTemperatureColor(temp);

    // Doppler beaming: brighter on approaching side
    float vel = sin(angle + u_time * u_rotation * 0.15);
    float doppler = 1.0 + vel * u_doppler * 0.55;
    doppler = clamp(doppler, 0.45, 1.85);

    float brightness = pow(radial, 0.55) * u_disk_brightness * doppler;
    brightness *= 0.75 + 0.45 * turb;

    // disk alpha: hide when deeply behind horizon projection
    float diskAlpha = smoothstep(rIn, rIn * 1.15, r) * smoothstep(rOut, rOut * 0.85, r);
    // foreshortening: thinner far side
    float side = mix(0.55, 1.0, 0.5 + 0.5 * cos(angle));
    diskAlpha *= side * horizon;

    color = mix(color, disk * brightness, clamp(diskAlpha, 0.0, 1.0));
    // additive glow for hot inner edge
    color += disk * brightness * 0.15 * smoothstep(rIn * 1.8, rIn, r) * horizon;
  }

  // ---- Photon ring (primary + faint secondary) ----
  float bPhoton = rs * 1.55;
  float ring1 = ringProfile(b, bPhoton, rs * 0.045);
  float ring2 = ringProfile(b, bPhoton * 1.18, rs * 0.07) * 0.35;
  float ringPulse = 0.85 + 0.15 * sin(u_time * 1.7);
  vec3 ringCol = vec3(0.85, 0.93, 1.0) * (ring1 + ring2) * u_ring_intensity * ringPulse;
  color += ringCol * horizon;

  // Soft glow around photon sphere
  float glow = exp(-pow((b - bPhoton) / (rs * 0.35), 2.0)) * 0.12 * u_ring_intensity;
  color += vec3(1.0, 0.7, 0.35) * glow * horizon;

  // ---- Optional illustrative jets (default low) ----
  if (u_jet_intensity > 0.001) {
    float jetW = 0.018 * (1.0 + 0.3 * abs(p.y));
    float along = abs(p.y);
    float core = smoothstep(jetW, 0.0, abs(p.x - 0.01 * sin(p.y * 12.0 + u_time)));
    float fall = smoothstep(0.55, 0.08, along) * step(rs * 1.1, along);
    float turbJ = fbm(vec2(p.x * 40.0, p.y * 8.0 - u_time * 2.0));
    vec3 jetCol = mix(vec3(0.25, 0.45, 1.0), vec3(0.9, 0.95, 1.0), along * 1.5);
    color += jetCol * core * fall * (0.5 + 0.5 * turbJ) * u_jet_intensity * 0.65;
  }

  // Black hole interior
  color *= horizon;
  // soft limb darkening into shadow
  color *= mix(0.0, 1.0, smoothstep(rs * 0.85, rs * 1.2, b));

  // Tonemap
  color = color / (1.0 + color * 0.65);
  color = pow(color, vec3(0.9));

  gl_FragColor = vec4(color, 1.0);
}
`;
