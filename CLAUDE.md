# Keycaps

Mixed-color keycap compositor. Pipeline: real photos of keycaps in 7 colors →
C#/OpenCV extraction (Phase 1, done) → static per-color tile/background PNGs +
JSON manifests → a browser GUI (Phase 2, done) where the user picks a pattern
or freely recolors individual keycaps, drags colors onto keycaps or palette
slots, and exports a composited PNG. A batch/headless export mode is a
mentioned but unstarted Phase 3 stretch goal.

## Directory map

- `src/` — the entire app layer. ES modules, zero runtime dependencies, one
  small build step (esbuild, for publishing only — day-to-day dev needs no
  build). Must be served over `http(s)://`, not opened via `file://` — see
  Hard constraints below.
  - `index.html` — markup + `<script type="module" src="./js/main.js">`
  - `styles.css` — all styling (CSS custom properties in `:root`, dark mode
    via `prefers-color-scheme`)
  - `js/*.js` — see "src/js internals" below
  - `data/manifest.json`, `data/patterns.json` — fetched at runtime by
    `js/data.js`. `manifest.json` is pipeline output (regenerate via
    `image-prep.linq`, never hand-edit). `patterns.json` is hand-authored
    (see its own `_comment`) — safe to hand-edit directly.
  - `assets/background.png`, `assets/tiles/*.png` (56 = 8 positions × 7
    colors), `assets/swatches/*.png` (7, one per color) — real image files,
    loaded by path, not embedded as data URIs.
- `dist/` — build output of `npm run build` (`scripts/build.js`, esbuild):
  `js/main.js` bundled+minified, `index.html`/`styles.css` copied verbatim,
  `data/` and `assets/` copied verbatim. **Never hand-edit — always
  regenerate via `npm run build`.**
- `images/` — Phase 1 asset pipeline, separate from the app:
  - `images/original/` — raw source photos (`PXL_*.jpg`)
  - `images/*.jpg` — per-color cropped/renamed source photos
  - `images/correction.pdn` / `.zip` — Paint.NET manual color-correction project
  - `images/scripts/image-prep.linq` — the actual pipeline (C#/OpenCvSharp4):
    reads the corrected PNGs, produces `images/corrected/output/manifest.json`,
    `images/corrected/patterns.json`, `output/background.png`, `output/tiles/`
  - `images/corrected/` — pipeline output; `src/data/manifest.json` and
    `src/assets/*` are copied from here (by hand — there's no script that
    does this copy automatically, so after re-running the pipeline you need
    to manually re-copy `output/manifest.json` → `src/data/manifest.json`,
    `output/background.png` → `src/assets/background.png`, and
    `output/tiles/*` → `src/assets/tiles/`, then `npm run build`).
    `images/corrected/patterns.json` is a separate hand-authored copy of
    `src/data/patterns.json` — the two have already drifted from each other
    once; keep pattern edits in sync between them by hand if it matters to you.
- `scripts/`
  - `dev-server.js` — minimal zero-dependency static file server for `src/`
    (`npm run dev`, default port 8080). No live-reload — refresh the browser
    after editing files.
  - `build.js` — bundles `src/` into `dist/` via esbuild (`npm run build`).
  - `clean-tiles.js` — Phase-1-adjacent utility: flood-fills near-black
    corner/margin artifacts out of `images/corrected/output/tiles/*.png`.
    Only touches that pipeline-output directory — after running it, manually
    re-copy the results into `src/assets/tiles/` and `npm run build` if
    `dist/` needs to match.
  - `regenerate-background.js` — **currently broken/stale.** It patches a
    base64 data URI inside `gui/assets.data.js`, a file that does not exist
    in this project, so running it today just fails with "assets.data.js
    not found". For `src/`, swapping the background image is simply
    overwriting `src/assets/background.png` with a same-size PNG directly
    (and `images/corrected/output/background.png` too, if you want the
    pipeline copy to match), then `npm run build`. Worth deciding whether to
    fix, repurpose, or delete this script if you touch it.
- `package.json` — dev-only tooling (esbuild, Playwright, pngjs). `src/`
  itself ships with zero runtime dependencies and no build step for local
  dev — do not introduce either without discussing it first.
- `README.md` — short public-facing overview + quick-start install/run
  instructions; points here for the full directory map and constraints.

## src/js internals

`main.js` is the entry point (`await loadData()` → `sizeCanvas()` → build the
UI → `preloadAll()` → set the first pattern → `init();` at module bottom).
Every other module is imported (real ES `import`/`export`, no globals):

- `constants.js` — `MAX_SLOTS`, `DISPLAY_SCALE`, asset path prefixes,
  `COLOR_HEX` (decorative-only hex approximations, for dots/previews that
  can't use the real swatch photos)
- `dom.js` — `dom` (all `getElementById` refs + canvas 2D context),
  `sizeCanvas()` (full-res backing store, CSS-scaled-down display —
  `canvas.style.width` only; height follows via `height:auto` in CSS, so the
  effective display scale is uniform on both axes)
- `data.js` — `loadData()` fetches `manifest.json`/`patterns.json` in
  parallel; `MANIFEST`/`PATTERNS` are exported as `let` bindings (live —
  other modules importing them see the loaded value once `loadData()`
  resolves, same pattern used throughout)
- `assets.js` — `images` Map keyed `"background"` or `"{position}_{color}"`,
  `preloadAll()`
- `state.js` — the state model; see below, it's the module most worth
  understanding before changing anything
- `render.js` — `redraw()` (canvas compositing), `renderSlotTray()`,
  `renderPatternGrid()`, `buildPatternPreview()`/`buildCustomTilePreview()`
  (schematic SVG previews for pattern-grid tiles, sharing a
  `buildKeycapPreviewSvg()` helper)
- `ui.js` — builds the pattern grid, swatch tray (drag source +
  click-to-select), slot tray (drop target + click-to-assign)
- `canvas-dnd.js` — makes the `<canvas>` itself a drag source *and* drop
  target for freeform per-keycap recoloring; see below
- `dots.js` — small color-dot rows + history-button content, shared by the
  undo/redo toolbar buttons and the favorites list
- `favorites.js` — localStorage load/save (key `keycaps.favorites.v1`),
  add/remove/load/render
- `export.js` — `downloadPng()` (canvas.toBlob → object URL → synthetic
  `<a download>` click)

## State model: pattern-based vs. Custom mode

Two independent ways of deciding what color each of the 8 keycap positions
(`down/edit/left/option/play/right/shift/up`) is painted, tracked in
`state.js`'s `state` object:

- **Pattern-based** (the original model): `state.activePattern` is a real
  entry from `PATTERNS.patterns` (`data/patterns.json`), each mapping every
  position to a palette-slot index (`pattern.keys[position]`); `state.slotColors[slotIndex]`
  holds the color assigned to each slot. `setState()`/`assignSlot()` are the
  setters.
- **Custom mode** (freeform per-keycap): `state.customMode = true`,
  `state.activePattern = CUSTOM_PATTERN` (a synthetic `{id:"custom", name:"Custom"}`
  marker — not in `patterns.json`, it's a UI-only marker with no `.keys`).
  `state.positionColors[position]` holds each keycap's color directly, no
  slot indirection. `setCustomState()`/`assignPositionColor()`/`enterCustomMode()`
  are the setters. Entered by dragging a color onto a keycap on the canvas
  (`canvas-dnd.js`) or by clicking the "Custom" tile in the pattern grid;
  exited by clicking any real pattern tile (`setState()` always clears
  `state.customMode`).

Both modes render through the same `redraw()` (`render.js`), which branches
per-position on `state.customMode` — the underlying compositing (one
independently-drawable tile image per position, `images.get(position + "_" + color)`)
was already granular enough for this; only the color lookup differs.

**Undo/redo history and Favorites both store two possible entry shapes**,
discriminated by a `custom` boolean: `{custom: false, patternId, slotColors}`
or `{custom: true, positionColors}`. Every place that reads a history/favorite
entry (`sameEntry`, `restoreEntry`, `entryPattern` in `state.js`;
`buildHistoryButtonContent` in `dots.js`; `renderFavorites`/`loadFavorite` in
`favorites.js`) branches on `.custom`. Old `localStorage` data predating this
has no `custom` field — treated as falsy, so it still loads as the
pattern-based shape with no migration needed.

`canvas-dnd.js` makes the canvas both a drop target (swatch tray → keycap,
or keycap → keycap) and a drag source (keycap → keycap or → nothing useful
elsewhere) — both directions deliver a plain color-name string via
`dataTransfer`, so one `drop` handler covers both origins. Hit-testing
(`hitTestPosition`) maps a canvas-relative CSS-pixel point to a keycap
position using each position's `bbox` from `manifest.json`, scaled by
`canvas.width / canvas.clientWidth` rather than the fixed `DISPLAY_SCALE`
constant, so it stays correct regardless of actual CSS layout. The drag ghost
(`buildDragThumbnail`) draws the real keycap tile onto a small offscreen
`<canvas>` sized to match its *on-screen* display size before handing it to
`setDragImage` — a bare `Image` passed to `setDragImage` renders at its
natural/intrinsic pixel size (the tile PNGs are ~299×281, far larger than a
keycap's ~180×170 on-screen size at the default `DISPLAY_SCALE`), which is
what made the drag ghost look oversized before this was added.

## Hard constraints

- **Must be served over `http(s)://`.** `npm run dev` (`scripts/dev-server.js`,
  default port 8080) for local dev; any static file server works the same
  way for `dist/`. This is required for:
  - `<script type="module">`, used for every script in `src/js/`.
  - `fetch()` of `data/manifest.json` and `data/patterns.json` in `data.js`.
  - Drawing local `<img>` files straight to `<canvas>` without tainting it
    (`getImageData`/`toBlob` stay usable) — same-origin `http(s)://` serving
    keeps the canvas untainted, so `background.png` and all `tiles/*.png`
    are referenced by real path, not base64 data URIs.
  - `localStorage` (favorites, exclusions) — works normally under `http(s)://`
    in every browser, including Firefox.
- **No build step for local dev, minimal runtime dependencies.** `npm run build`
  (esbuild) exists only to produce a bundled/minified `dist/` for publishing —
  don't make it a requirement for day-to-day development, and don't add
  runtime (non-dev) dependencies without discussing it first.

## Testing

No automated test currently exists. Playwright is available as a
devDependency (`node_modules/playwright`) if a test suite for `src/` is
wanted later — point it at `npm run dev`'s served URL.
