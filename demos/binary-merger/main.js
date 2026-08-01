/**
 * Binary merger demo — Squalor LLC / MPL-2.0
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
import { createTimeLoop } from "../../js/lib/time-loop.js";
import { vertexShader, fragmentShader } from "../../js/shaders/merger.js";

const qualityDefault = defaultQuality();

const defaults = {
  brightness: 1.0,
  ring: 1.0,
  quality: qualityDefault,
};

const state = { ...defaults };

setupDemoChrome();

const notice = document.getElementById("notice");
if (notice) {
  notice.innerHTML = licenseNoticeHtml({ demoPath: "demos/binary-merger" });
}

const canvas = document.getElementById("c");
const banner = document.getElementById("error-banner");
const scrubber = document.getElementById("scrubber");
const playBtn = document.getElementById("play");
const playBar = document.getElementById("play-bar");

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
    "u_progress",
    "u_brightness",
    "u_ring_intensity",
  ]) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }
} catch (err) {
  showError(`Shader error:\n${err.message || err}`, banner);
  throw err;
}

const binders = {
  brightness: bindRange("brightness", {
    get: () => state.brightness,
    set: (v) => { state.brightness = v; },
  }, { valueEl: "brightness-v" }),
  ring: bindRange("ring", {
    get: () => state.ring,
    set: (v) => { state.ring = v; },
  }, { valueEl: "ring-v" }),
};

bindSelect("quality", (v) => {
  state.quality = v;
}, state.quality);

function setPlayingUI(playing) {
  const label = playing ? "Pause" : "Play";
  if (playBtn) playBtn.textContent = label;
  if (playBar) playBar.textContent = label;
}

const timeLoop = createTimeLoop({
  durationSec: 90,
  scrubber: scrubber instanceof HTMLInputElement ? scrubber : null,
  labelEl: document.getElementById("progress-label"),
  playButton: null,
  onProgress: () => {},
});

function togglePlay() {
  timeLoop.setPlaying(!timeLoop.playing);
  setPlayingUI(timeLoop.playing);
}

playBtn?.addEventListener("click", togglePlay);
playBar?.addEventListener("click", togglePlay);

document.getElementById("reset")?.addEventListener("click", () => {
  Object.assign(state, defaults);
  binders.brightness?.reset(defaults.brightness);
  binders.ring?.reset(defaults.ring);
  const q = document.getElementById("quality");
  if (q) q.value = defaults.quality;
  state.quality = defaults.quality;
  timeLoop.progress = 0;
  timeLoop.setPlaying(true);
  setPlayingUI(true);
});

const start = performance.now();

const loop = createVisibilityLoop((now) => {
  const progress = timeLoop.tick(now);
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
  gl.uniform1f(uniforms.u_progress, progress);
  gl.uniform1f(uniforms.u_brightness, state.brightness);
  gl.uniform1f(uniforms.u_ring_intensity, state.ring);

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  quad.draw();
});

loop.start();
