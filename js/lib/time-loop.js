/**
 * Progress loop with scrubber + autoplay — Squalor LLC / MPL-2.0
 */

/**
 * @param {{
 *   durationSec?: number,
 *   onProgress?: (p: number) => void,
 *   scrubber?: HTMLInputElement | null,
 *   labelEl?: HTMLElement | null,
 *   playButton?: HTMLButtonElement | null,
 * }} opts
 */
export function createTimeLoop(opts = {}) {
  const duration = opts.durationSec ?? 90;
  let progress = 0;
  let playing = true;
  let lastTs = null;

  const scrubber = opts.scrubber || null;
  const labelEl = opts.labelEl || null;
  const playButton = opts.playButton || null;

  function emit() {
    if (scrubber && document.activeElement !== scrubber) {
      scrubber.value = String(progress);
    }
    if (labelEl) {
      labelEl.textContent = `${Math.round(progress * 100)}%`;
    }
    if (opts.onProgress) opts.onProgress(progress);
  }

  if (scrubber) {
    scrubber.addEventListener("input", () => {
      progress = parseFloat(scrubber.value);
      emit();
    });
  }

  if (playButton) {
    playButton.addEventListener("click", () => {
      playing = !playing;
      playButton.textContent = playing ? "Pause" : "Play";
      lastTs = null;
    });
  }

  return {
    get progress() {
      return progress;
    },
    set progress(p) {
      progress = Math.min(1, Math.max(0, p));
      emit();
    },
    get playing() {
      return playing;
    },
    setPlaying(v) {
      playing = !!v;
      if (playButton) playButton.textContent = playing ? "Pause" : "Play";
      lastTs = null;
    },
    /**
     * @param {number} nowMs
     */
    tick(nowMs) {
      if (!playing) {
        lastTs = nowMs;
        return progress;
      }
      if (lastTs == null) lastTs = nowMs;
      const dt = Math.min(0.1, (nowMs - lastTs) / 1000);
      lastTs = nowMs;
      progress += dt / duration;
      if (progress >= 1) progress = progress % 1;
      emit();
      return progress;
    },
  };
}
