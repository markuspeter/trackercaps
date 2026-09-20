# Trackercaps

A browser tool for previewing mixed-color keycap sets on the [Dirtywave M8
Tracker](https://dirtywave.com/), using third-party MBK Choc V1 1u low-profile
keycaps (compatible with the M8's Kailh Choc switches). Pick a pattern or
freely recolor individual keycaps using photos of the 7 available keycap
colors, then export a composited PNG.

Not affiliated with or endorsed by Dirtywave — a fan-made tool built from
real photos of the keycaps.

## Quick start

```
npm install
npm run dev
```

Then open the served URL (default `http://localhost:8080`) in a browser.
Must be served over `http(s)://`, not opened via `file://`.

See [`CLAUDE.md`](CLAUDE.md) for the full directory map, internals, and
constraints.

## Build & deploy

Every push to `main` (including merged PRs) automatically:

1. Builds `dist/` via `npm run build`.
2. Tags a new release (`vX.Y.Z`, patch bump by default — include `(MINOR)`
   or `(MAJOR)` in a commit message to bump those instead) and publishes it
   as a GitHub Release with the built `dist/` attached as a zip.
3. Deploys `dist/` to GitHub Pages.

`package.json`'s `"version"` field is not updated automatically — git tags
and GitHub Releases are the source of truth for the app's version.
