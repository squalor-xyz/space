/**
 * Minimal WebGL1 helpers — Squalor LLC / MPL-2.0
 * No external dependencies. Desktop + mobile browsers.
 */

const DEFAULT_MAX_DIM_DESKTOP = 2560;
const DEFAULT_MAX_DIM_MOBILE = 1440;
const DEFAULT_MAX_DPR_DESKTOP = 2;
const DEFAULT_MAX_DPR_MOBILE = 1.5;

/**
 * Coarse pointer or narrow viewport → treat as mobile-like for defaults.
 * @returns {boolean}
 */
export function isMobileLike() {
  try {
    if (window.matchMedia("(pointer: coarse)").matches) return true;
    if (window.matchMedia("(max-width: 640px)").matches) return true;
    // iPadOS may report as desktop pointer with touch
    if (navigator.maxTouchPoints > 1 && window.matchMedia("(max-width: 1024px)").matches) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Suggested quality default for this device.
 * @returns {"low"|"medium"|"high"}
 */
export function defaultQuality() {
  return isMobileLike() ? "low" : "medium";
}

/**
 * @returns {{ maxDpr: number, maxDim: number }}
 */
export function deviceRenderCaps() {
  if (isMobileLike()) {
    return { maxDpr: DEFAULT_MAX_DPR_MOBILE, maxDim: DEFAULT_MAX_DIM_MOBILE };
  }
  return { maxDpr: DEFAULT_MAX_DPR_DESKTOP, maxDim: DEFAULT_MAX_DIM_DESKTOP };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ antialias?: boolean, powerPreference?: string }} [opts]
 * @returns {WebGLRenderingContext | null}
 */
export function createContext(canvas, opts = {}) {
  const mobile = isMobileLike();
  const powerPreference =
    opts.powerPreference || (mobile ? "default" : "high-performance");
  // Antialias is expensive on mobile tile GPUs; default off there
  const antialias =
    opts.antialias != null ? opts.antialias : !mobile;

  const attrs = {
    antialias,
    alpha: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference,
  };

  const gl =
    canvas.getContext("webgl", attrs) ||
    canvas.getContext("experimental-webgl", {
      antialias: attrs.antialias,
      alpha: false,
    });
  return gl;
}

/**
 * @param {WebGLRenderingContext} gl
 * @param {number} type
 * @param {string} source
 * @returns {WebGLShader}
 */
export function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("createShader failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || "unknown compile error";
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

/**
 * @param {WebGLRenderingContext} gl
 * @param {string} vertexSource
 * @param {string} fragmentSource
 * @returns {WebGLProgram}
 */
export function createProgram(gl, vertexSource, fragmentSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("createProgram failed");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || "unknown link error";
    gl.deleteProgram(program);
    throw new Error(log);
  }
  return program;
}

/**
 * Full-screen quad (6 verts) for max WebGL1 compatibility.
 * @param {WebGLRenderingContext} gl
 * @param {WebGLProgram} program
 * @param {string} [attrName]
 * @returns {{ draw: () => void, dispose: () => void }}
 */
export function createFullscreenQuad(gl, program, attrName = "a_position") {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );
  const loc = gl.getAttribLocation(program, attrName);

  return {
    draw() {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    dispose() {
      gl.deleteBuffer(buffer);
    },
  };
}

/**
 * Resize canvas drawing buffer from CSS size with DPR and max-dimension caps.
 * @param {HTMLCanvasElement} canvas
 * @param {{ maxDpr?: number, maxDim?: number, qualityScale?: number }} [opts]
 * @returns {{ width: number, height: number, changed: boolean }}
 */
export function resizeCanvasToDisplaySize(canvas, opts = {}) {
  const caps = deviceRenderCaps();
  const maxDpr = opts.maxDpr ?? caps.maxDpr;
  const maxDim = opts.maxDim ?? caps.maxDim;
  const qualityScale = opts.qualityScale ?? 1;

  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr) * qualityScale;
  let w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  let h = Math.max(1, Math.floor(canvas.clientHeight * dpr));

  const longest = Math.max(w, h);
  if (longest > maxDim) {
    const s = maxDim / longest;
    w = Math.max(1, Math.floor(w * s));
    h = Math.max(1, Math.floor(h * s));
  }

  const changed = canvas.width !== w || canvas.height !== h;
  if (changed) {
    canvas.width = w;
    canvas.height = h;
  }
  return { width: w, height: h, changed };
}

/**
 * @param {string} message
 * @param {HTMLElement | null} [bannerEl]
 */
export function showError(message, bannerEl) {
  const el = bannerEl || document.getElementById("error-banner");
  if (el) {
    el.textContent = message;
    el.classList.add("visible");
  }
  console.error(message);
}

/**
 * Quality preset → render scale multiplier.
 * @param {"low"|"medium"|"high"} level
 */
export function qualityScale(level) {
  switch (level) {
    case "low":
      return 0.5;
    case "high":
      return 1;
    case "medium":
    default:
      return 0.75;
  }
}

/**
 * rAF loop that pauses when the document is hidden (saves mobile battery/GPU).
 * @param {(now: number) => void} onFrame
 * @returns {{ start: () => void, stop: () => void }}
 */
export function createVisibilityLoop(onFrame) {
  let rafId = 0;
  let running = false;

  function tick(now) {
    if (!running) return;
    if (document.hidden) {
      rafId = 0;
      return;
    }
    onFrame(now);
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    if (!document.hidden) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function stop() {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (!running) return;
    if (document.hidden) {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    } else {
      rafId = requestAnimationFrame(tick);
    }
  });

  return { start, stop };
}
