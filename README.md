# Space

Real-time black hole visualizations in the browser.

**Live:** [https://space.squalor.xyz](https://space.squalor.xyz)

**Squalor LLC** · Free and open source under the [Mozilla Public License 2.0](https://www.mozilla.org/MPL/2.0/).

This site is hosted **on its own** GitHub Pages custom domain. It is not nested under [squalor.xyz](https://squalor.xyz) (the LLC marketing site).

## Demos

| Demo | Path |
|------|------|
| Sagittarius A\* | [`demos/sagittarius-a/`](demos/sagittarius-a/) |
| Binary merger | [`demos/binary-merger/`](demos/binary-merger/) |

Hub page: [`index.html`](index.html)

These are **artistic real-time visualizations** (WebGL1 + GLSL), not general-relativity integrators or EHT reconstructions. Each demo includes a short “what this approximates” note.

## Browsers (desktop + mobile)

Designed to run in **desktop and mobile browsers** with WebGL:

- Desktop: current Chrome, Firefox, Safari, Edge
- Mobile: current iOS Safari, Android Chrome

No native app. Touch-friendly controls (collapsible Controls / About on small screens), safe-area padding, lower default quality and DPR caps on phones, and the animation loop pauses when the tab is hidden.

If WebGL is unavailable, demos show an on-page error instead of a blank screen.

## Run locally

ES modules need HTTP (not `file://`):

```bash
# from the repo root
python3 -m http.server 8080
```

Open `http://localhost:8080/` on a computer or phone on the same network (`http://<your-lan-ip>:8080/`).

No `npm install`. No build step. No runtime dependencies.

## GitHub Pages (`space.squalor.xyz`)

1. **Repo settings → Pages**
   - Source: Deploy from branch **`main`**, folder **`/ (root)`**
   - Custom domain: **`space.squalor.xyz`** (this repo’s root `CNAME` file)
   - After DNS verifies: enable **Enforce HTTPS**
2. **DNS** (on the `squalor.xyz` zone):

   | Type | Name | Target |
   |------|------|--------|
   | CNAME | `space` | `squalor-xyz.github.io` |

Relative paths are used throughout so project sites and custom domains both work. Keep the root `.nojekyll` file so GitHub’s Jekyll step does not interfere with static assets.

## Stack

- Static HTML / CSS / ES modules
- WebGL1 fragment shaders
- Procedural backgrounds (no required CDN textures)
- Zero npm dependencies

## License

MPL-2.0 — see [LICENSE](LICENSE).

## History

Older AI multi-model HTML experiments lived under `blackhole/` and were removed in favor of this structure. Recover them with:

```bash
git show pre-cleanup-archive:blackhole/
# or
git checkout pre-cleanup-archive -- blackhole
```
