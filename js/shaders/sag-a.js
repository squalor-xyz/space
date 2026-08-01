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
// 0 = low, 1 = medium, 2 = high
uniform float u_quality;

${hashNoise}

float ringProfile(float b, float b0, float width) {
  float x = (b - b0) / max(width, 1e-5);
  return exp(-x * x);
}

vec3 diskTemperatureColor(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 cool = vec3(0.45, 0.08, 0.03);
  vec3 warm = vec3(1.0, 0.42, 0.1);
  vec3 hot = vec3(1.0, 0.94, 0.82);
  if (t < 0.4) {
    return mix(cool, warm, t / 0.4);
  }
  return mix(warm, hot, (t - 0.4) / 0.6);
}

// Stronger near photon sphere, soft far field; safe at b→0
float deflectionAmount(float b, float rs) {
  float eps = 1e-4;
  float bb = max(b, eps);
  // Base inverse + peak near ~1.5 rs
  float base = (1.65 * rs) / bb;
  float peak = exp(-pow((bb - 1.55 * rs) / (0.55 * rs), 2.0)) * 0.85;
  float far = smoothstep(6.0 * rs, 1.2 * rs, bb);
  float d = (base * 0.42 + peak) * far;
  return min(d, 2.8);
}

vec3 starfield(vec2 p, float quality) {
  vec3 col = vec3(0.008, 0.01, 0.028);
  col += vec3(0.018, 0.022, 0.05) * fbm(p * 1.4 + 2.7);

  // Primary star cells
  vec2 gv = fract(p * 20.0) - 0.5;
  vec2 id = floor(p * 20.0);
  float n = hash21(id);
  vec2 off = vec2(n - 0.5, hash21(id + 19.0) - 0.5) * 0.4;
  float d = length(gv - off);
  float star = smoothstep(0.028, 0.0, d) * step(0.9, n);
  float twinkle = 0.72 + 0.28 * sin(u_time * (1.2 + n * 2.8) + n * 18.0);
  col += vec3(0.92, 0.96, 1.0) * star * twinkle * (0.45 + 0.55 * n);

  // Secondary dim layer (skip on low quality)
  if (quality > 0.5) {
    vec2 gv2 = fract(p * 48.0) - 0.5;
    vec2 id2 = floor(p * 48.0);
    float n2 = hash21(id2 + 4.2);
    float star2 = smoothstep(0.018, 0.0, length(gv2)) * step(0.965, n2);
    col += vec3(0.55, 0.6, 0.7) * star2 * 0.35;
  }

  // Sparse brighter giants on high quality
  if (quality > 1.5) {
    vec2 id3 = floor(p * 9.0);
    float n3 = hash21(id3 + 8.1);
    vec2 gv3 = fract(p * 9.0) - 0.5;
    float giant = smoothstep(0.04, 0.0, length(gv3 - (n3 - 0.5) * 0.2)) * step(0.97, n3);
    col += vec3(1.0, 0.95, 0.85) * giant * 0.7;
  }

  return col;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

  float rs = 0.115;
  float b = length(p);
  float eps = 1e-4;
  vec2 dir = p / max(b, eps);

  float defl = deflectionAmount(b, rs);
  vec2 lensed = p - dir * defl;

  // Cheap second sample for stretch near the photon sphere (medium+)
  vec3 bg;
  if (u_quality > 0.5) {
    float defl2 = deflectionAmount(b, rs) * 0.72;
    vec2 lensed2 = p - dir * defl2;
    vec3 s1 = starfield(lensed * 1.35 + vec2(0.0, u_time * 0.0015), u_quality);
    vec3 s2 = starfield(lensed2 * 1.35 + vec2(0.07, u_time * 0.0012), u_quality);
    // blend more stretch near critical curve
    float stretch = exp(-pow((b - 1.55 * rs) / (0.9 * rs), 2.0));
    bg = mix(s1, 0.55 * s1 + 0.45 * s2, stretch * 0.65);
  } else {
    bg = starfield(lensed * 1.35 + vec2(0.0, u_time * 0.0015), u_quality);
  }

  // Dim background into the well
  bg *= mix(0.08, 1.0, smoothstep(rs * 0.9, rs * 4.5, b));

  float horizon = smoothstep(rs * 0.96, rs * 1.06, b);
  vec3 color = bg;
  vec3 bloomAccum = vec3(0.0);

  // ---- Inclined thin disk with spiral structure ----
  float inc = clamp(u_inclination, 0.2, 0.88);
  vec2 dp = vec2(lensed.x, lensed.y / max(inc, 0.22));
  float r = length(dp);
  float angle = atan(dp.y, dp.x);

  float rIn = rs * 1.78;
  float rOut = rs * 7.8;

  // Soft vertical thickness of the projected disk
  float diskPlane = smoothstep(rOut * 0.95, rOut * 0.35, abs(lensed.y));

  if (r > rIn * 0.92 && r < rOut && diskPlane > 0.01) {
    float omega = 1.0 / pow(max(r, rIn), 1.5);
    float swirl = angle + u_time * u_rotation * omega * 2.4;

    // Logarithmic spiral arms
    float arms = 2.0;
    float pitch = 3.8;
    float spiral = 0.5 + 0.5 * sin(arms * swirl - log(max(r, rIn)) * pitch);
    spiral = pow(spiral, 1.6);

    float turb = fbm(vec2(swirl * 1.3, r * 9.0 - u_time * u_rotation * 0.35));
    if (u_quality < 0.5) {
      turb = noise2(vec2(swirl * 2.0, r * 6.0));
    }

    float radial = 1.0 - (r - rIn) / (rOut - rIn);
    radial = clamp(radial, 0.0, 1.0);

    // Sharp ISCO-like inner rim
    float innerEdge = smoothstep(rIn * 0.98, rIn * 1.12, r);
    float outerFade = smoothstep(rOut, rOut * 0.72, r);

    float temp = pow(radial, 0.55);
    temp = mix(temp, temp * (0.7 + 0.55 * turb), 0.4);
    temp = mix(temp, temp * (0.65 + 0.7 * spiral), 0.35);

    vec3 disk = diskTemperatureColor(temp);

    // Doppler beaming (approaching side brighter)
    float vel = sin(angle);
    float doppler = 1.0 + vel * u_doppler * 0.65;
    doppler = clamp(doppler, 0.4, 2.0);

    float structure = 0.55 + 0.45 * spiral;
    structure *= 0.7 + 0.4 * turb;

    float brightness = pow(radial, 0.45) * u_disk_brightness * doppler * structure;
    // Hot inner rim boost
    brightness *= 1.0 + 0.55 * smoothstep(rIn * 2.2, rIn, r);

    float diskAlpha = innerEdge * outerFade * diskPlane * horizon;
    // Foreshortening / far-side dimming
    float side = mix(0.5, 1.0, 0.5 + 0.5 * cos(angle));
    diskAlpha *= side;

    vec3 diskLit = disk * brightness;
    color = mix(color, diskLit, clamp(diskAlpha, 0.0, 1.0));

    // Additive inner emissive core of the disk
    float rim = smoothstep(rIn * 2.0, rIn, r) * diskAlpha;
    color += disk * brightness * 0.22 * rim;
    bloomAccum += disk * brightness * rim * 0.55;
  }

  // ---- Primary photon ring (stable position, soft intensity pulse) ----
  float bPhoton = rs * 1.52;
  float ringW = rs * (u_quality > 1.5 ? 0.028 : 0.036);
  float ring1 = ringProfile(b, bPhoton, ringW);
  // Very faint secondary (high quality only)
  float ring2 = 0.0;
  if (u_quality > 1.5) {
    ring2 = ringProfile(b, bPhoton * 1.14, ringW * 1.6) * 0.18;
  }
  float ringPulse = 0.9 + 0.1 * sin(u_time * 1.35);
  float ringAmt = (ring1 + ring2) * u_ring_intensity * ringPulse * horizon;
  vec3 ringCol = vec3(0.88, 0.94, 1.0) * ringAmt;
  color += ringCol;
  bloomAccum += ringCol * 0.9;

  // Soft critical-curve shoulder (not a second “disco” ring)
  float shoulder = exp(-pow((b - bPhoton) / (rs * 0.42), 2.0)) * 0.1 * u_ring_intensity * horizon;
  color += vec3(1.0, 0.72, 0.4) * shoulder;
  bloomAccum += vec3(1.0, 0.65, 0.3) * shoulder * 0.6;

  // ---- Optional illustrative jets ----
  if (u_jet_intensity > 0.001) {
    float jetW = 0.016 * (1.0 + 0.25 * abs(p.y));
    float along = abs(p.y);
    float core = smoothstep(jetW, 0.0, abs(p.x - 0.008 * sin(p.y * 14.0 + u_time * 0.8)));
    float fall = smoothstep(0.52, 0.1, along) * step(rs * 1.15, along);
    float turbJ = u_quality < 0.5
      ? noise2(vec2(p.x * 30.0, p.y * 6.0 - u_time))
      : fbm(vec2(p.x * 40.0, p.y * 8.0 - u_time * 2.0));
    vec3 jetCol = mix(vec3(0.22, 0.42, 1.0), vec3(0.9, 0.95, 1.0), clamp(along * 1.6, 0.0, 1.0));
    vec3 jets = jetCol * core * fall * (0.5 + 0.5 * turbJ) * u_jet_intensity * 0.6;
    color += jets;
    bloomAccum += jets * 0.35;
  }

  // Horizon mask
  color *= horizon;
  color *= mix(0.0, 1.0, smoothstep(rs * 0.82, rs * 1.18, b));
  bloomAccum *= horizon;

  // ---- Single-pass soft bloom (luma-weighted glow of hot features) ----
  float bloomScale = u_quality < 0.5 ? 0.35 : (u_quality < 1.5 ? 0.55 : 0.7);
  // Radial soft kernel approximation: spread bloomAccum with distance-based falloff from center features
  float bloomFall = exp(-pow(max(b - bPhoton, 0.0) / (rs * 1.8), 1.4));
  vec3 bloom = bloomAccum * bloomFall * bloomScale;
  // Extra wide halo from accumulated brightness
  float luma = dot(bloomAccum, vec3(0.3, 0.5, 0.2));
  bloom += vec3(1.0, 0.75, 0.45) * luma * exp(-b * b / (rs * rs * 18.0)) * bloomScale * 0.45;
  color += bloom;

  // Tonemap (protect highlights after bloom)
  color = color / (1.0 + color * 0.72);
  color = pow(max(color, vec3(0.0)), vec3(0.92));

  gl_FragColor = vec4(color, 1.0);
}
`;
