/**
 * Sagittarius A* demo — Squalor LLC / MPL-2.0
 * Desktop + mobile browsers.
 */

import {
  createContext,
  createProgram,
  createFullscreenQuad,
  resizeCanvasToDisplaySize,
  showError,
  qualityScale,
  defaultQuality,
  deviceRenderCaps,
  createVisibilityLoop,
} from "../../js/lib/webgl.js";
import {
  bindRange,
  bindSelect,
  licenseNoticeHtml,
  setupDemoChrome,
} from "../../js/lib/ui.js";
import { vertexShader, fragmentShader } from "../../js/shaders/sag-a.js";

const qualityDefault = defaultQuality();

const defaults = {
  disk: 1.1,
  rotation: 1.0,
  doppler: 1.0,
  ring: 1.2,
  inclination: 0.48,
  jet: 0.15,
  quality: qualityDefault,
};

const state = { ...defaults };

setupDemoChrome();

const notice = document.getElementById("notice");
if (notice) {
  notice.innerHTML = licenseNoticeHtml({ demoPath: "demos/sagittarius-a" });
}

const canvas = document.getElementById("c");
const banner = document.getElementById("error-banner");

const gl = createContext(canvas);
if (!gl) {
  showError(
    "WebGL is not available in this browser. Try a current Firefox, Chrome, Safari, or Edge on desktop or mobile.",
    banner
  );
  throw new Error("WebGL unavailable");
}

let program;
let quad;
/** @type {Record<string, WebGLUniformLocation | null>} */
let uniforms = {};

try {
  program = createProgram(gl, vertexShader, fragmentShader);
  gl.useProgram(program);
  quad = createFullscreenQuad(gl, program, "a_position");
  for (const name of [
    "u_resolution",
    "u_time",
    "u_disk_brightness",
    "u_rotation",
    "u_doppler",
    "u_ring_intensity",
    "u_jet_intensity",
    "u_inclination",
  ]) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }
} catch (err) {
  showError(`Shader error:\n${err.message || err}`, banner);
  throw err;
}

const binders = {
  disk: bindRange("disk", {
    get: () => state.disk,
    set: (v) => { state.disk = v; },
  }, { valueEl: "disk-v" }),
  rotation: bindRange("rotation", {
    get: () => state.rotation,
    set: (v) => { state.rotation = v; },
  }, { valueEl: "rotation-v" }),
  doppler: bindRange("doppler", {
    get: () => state.doppler,
    set: (v) => { state.doppler = v; },
  }, { valueEl: "doppler-v" }),
  ring: bindRange("ring", {
    get: () => state.ring,
    set: (v) => { state.ring = v; },
  }, { valueEl: "ring-v" }),
  inclination: bindRange("inclination", {
    get: () => state.inclination,
    set: (v) => { state.inclination = v; },
  }, { valueEl: "inclination-v", decimals: 2 }),
  jet: bindRange("jet", {
    get: () => state.jet,
    set: (v) => { state.jet = v; },
  }, { valueEl: "jet-v" }),
};

bindSelect("quality", (v) => {
  state.quality = v;
}, state.quality);

document.getElementById("reset")?.addEventListener("click", () => {
  Object.assign(state, defaults);
  binders.disk?.reset(defaults.disk);
  binders.rotation?.reset(defaults.rotation);
  binders.doppler?.reset(defaults.doppler);
  binders.ring?.reset(defaults.ring);
  binders.inclination?.reset(defaults.inclination);
  binders.jet?.reset(defaults.jet);
  const q = document.getElementById("quality");
  if (q) q.value = defaults.quality;
  state.quality = defaults.quality;
});

const start = performance.now();

const loop = createVisibilityLoop((now) => {
  const caps = deviceRenderCaps();
  const scale = qualityScale(state.quality);
  const { width, height } = resizeCanvasToDisplaySize(canvas, {
    qualityScale: scale,
    maxDpr: caps.maxDpr,
    maxDim: caps.maxDim,
  });
  gl.viewport(0, 0, width, height);

  gl.useProgram(program);
  gl.uniform2f(uniforms.u_resolution, width, height);
  gl.uniform1f(uniforms.u_time, (now - start) / 1000);
  gl.uniform1f(uniforms.u_disk_brightness, state.disk);
  gl.uniform1f(uniforms.u_rotation, state.rotation);
  gl.uniform1f(uniforms.u_doppler, state.doppler);
  gl.uniform1f(uniforms.u_ring_intensity, state.ring);
  gl.uniform1f(uniforms.u_jet_intensity, state.jet);
  gl.uniform1f(uniforms.u_inclination, state.inclination);

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  quad.draw();
});

loop.start();
