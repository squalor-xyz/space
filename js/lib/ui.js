/**
 * Lightweight control helpers — Squalor LLC / MPL-2.0
 * Desktop + mobile UI helpers.
 */

/**
 * Bind a range input to a numeric state object.
 * @param {string | HTMLInputElement} idOrEl
 * @param {{ get: () => number, set: (v: number) => void }} binding
 * @param {{ decimals?: number, valueEl?: string | HTMLElement | null }} [opts]
 */
export function bindRange(idOrEl, binding, opts = {}) {
  const el =
    typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;
  if (!el || !(el instanceof HTMLInputElement)) return;

  const decimals = opts.decimals ?? 1;
  const valueEl =
    typeof opts.valueEl === "string"
      ? document.getElementById(opts.valueEl)
      : opts.valueEl;

  const syncLabel = () => {
    if (valueEl) valueEl.textContent = Number(el.value).toFixed(decimals);
  };

  el.value = String(binding.get());
  syncLabel();

  el.addEventListener("input", () => {
    binding.set(parseFloat(el.value));
    syncLabel();
  });

  return {
    reset(v) {
      el.value = String(v);
      binding.set(v);
      syncLabel();
    },
  };
}

/**
 * @param {string | HTMLSelectElement} idOrEl
 * @param {(value: string) => void} onChange
 * @param {string} [initial]
 */
export function bindSelect(idOrEl, onChange, initial) {
  const el =
    typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;
  if (!el || !(el instanceof HTMLSelectElement)) return;
  if (initial != null) el.value = initial;
  el.addEventListener("change", () => onChange(el.value));
  return el;
}

/**
 * Footer / notice text for demos.
 * @param {{ demoPath?: string }} [opts]
 */
export function licenseNoticeHtml(opts = {}) {
  const path = opts.demoPath || "";
  const source = path
    ? `https://github.com/squalor-xyz/space/tree/main/${path}`
    : "https://github.com/squalor-xyz/space";
  return (
    `© Squalor LLC · Licensed under the <a href="https://www.mozilla.org/MPL/2.0/" target="_blank" rel="noopener">Mozilla Public License 2.0</a>. ` +
    `Source: <a href="${source}" target="_blank" rel="noopener">GitHub</a>.`
  );
}

/**
 * Wire floating Controls / About toggles for mobile-friendly chrome.
 * Expects optional elements: #btn-controls, #btn-about, #controls-panel, #info-panel
 * Body gets .controls-open / .about-open for layout (e.g. scrubber offset).
 */
export function setupDemoChrome() {
  const body = document.body;
  const controlsPanel = document.getElementById("controls-panel");
  const infoPanel = document.getElementById("info-panel");
  const btnControls = document.getElementById("btn-controls");
  const btnAbout = document.getElementById("btn-about");
  const btnCloseControls = document.getElementById("btn-close-controls");
  const btnCloseAbout = document.getElementById("btn-close-about");

  function setControlsOpen(open) {
    body.classList.toggle("controls-open", open);
    if (controlsPanel) {
      controlsPanel.hidden = !open;
      controlsPanel.setAttribute("aria-hidden", open ? "false" : "true");
    }
    if (btnControls) {
      btnControls.setAttribute("aria-expanded", open ? "true" : "false");
    }
  }

  function setAboutOpen(open) {
    body.classList.toggle("about-open", open);
    if (infoPanel) {
      infoPanel.hidden = !open;
      infoPanel.setAttribute("aria-hidden", open ? "false" : "true");
    }
    if (btnAbout) {
      btnAbout.setAttribute("aria-expanded", open ? "true" : "false");
    }
  }

  // Desktop: panels visible by default. Mobile: collapsed until toggled.
  const mobile =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 640px)").matches;

  if (mobile) {
    setControlsOpen(false);
    setAboutOpen(false);
  } else {
    setControlsOpen(true);
    setAboutOpen(true);
    // Hide chrome toggle bar noise on large screens is optional — keep toggles available
  }

  btnControls?.addEventListener("click", () => {
    const open = !body.classList.contains("controls-open");
    setControlsOpen(open);
    if (open) setAboutOpen(false);
  });

  btnAbout?.addEventListener("click", () => {
    const open = !body.classList.contains("about-open");
    setAboutOpen(open);
    if (open) setControlsOpen(false);
  });

  btnCloseControls?.addEventListener("click", () => setControlsOpen(false));
  btnCloseAbout?.addEventListener("click", () => setAboutOpen(false));

  // Escape closes overlays
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      setControlsOpen(false);
      setAboutOpen(false);
    }
  });

  return { setControlsOpen, setAboutOpen };
}
