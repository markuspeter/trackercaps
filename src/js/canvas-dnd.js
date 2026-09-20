import { dom } from "./dom.js";
import { MANIFEST } from "./data.js";
import { state, resolveCurrentColor, assignPositionColor } from "./state.js";
import { images } from "./assets.js";

/** Maps a canvas-relative CSS-pixel point (as given by ev.offsetX/offsetY on any
 * canvas mouse/drag event) to the keycap position it falls inside, or null. Scales
 * by canvas.width/clientWidth (rather than the fixed DISPLAY_SCALE constant) so it
 * stays correct regardless of CSS layout/zoom. bbox is identical across colors for
 * a given position (only `shift` differs), so any color's entry works - same trick
 * buildPatternPreview uses. */
function hitTestPosition(offsetX, offsetY) {
	const scaleX = dom.canvas.width / dom.canvas.clientWidth;
	const scaleY = dom.canvas.height / dom.canvas.clientHeight;
	const x = offsetX * scaleX;
	const y = offsetY * scaleY;
	for (const [position, byColor] of Object.entries(MANIFEST.positions)) {
		const [bx, by, bw, bh] = Object.values(byColor)[0].bbox;
		if (x >= bx && x < bx + bw && y >= by && y < by + bh) return position;
	}
	return null;
}

/** Snapshot of one keycap tile, scaled down to match how large that keycap
 * actually appears on screen - the canvas backing store is full resolution
 * (accurate PNG export) but CSS-scaled down for display, and a native drag
 * image defaults to an image's *natural* pixel size, not its rendered size, so
 * passing the raw (full-res) tile straight to setDragImage would show an
 * oversized ghost while dragging one keycap's color onto another. */
function buildDragThumbnail(position, color) {
	const tileImg = images.get(position + "_" + color);
	const bboxInfo = MANIFEST.positions[position][color];
	if (!tileImg || !bboxInfo) return null;
	const displayScale = dom.canvas.clientWidth / dom.canvas.width;
	const [, , bw, bh] = bboxInfo.bbox;
	const w = Math.max(1, Math.round(bw * displayScale));
	const h = Math.max(1, Math.round(bh * displayScale));
	const thumb = document.createElement("canvas");
	thumb.width = w;
	thumb.height = h;
	thumb.getContext("2d").drawImage(tileImg, 0, 0, w, h);
	return thumb;
}

/** Makes the canvas both a drag source (drag a keycap's current color onto another
 * keycap) and a drop target (drag a swatch, or another keycap's color, onto a
 * keycap) - both deliver a plain color string via dataTransfer, so the drop
 * handler covers both origins identically. */
export function initCanvasDragDrop() {
	dom.canvas.draggable = true;

	dom.canvas.addEventListener("dragstart", ev => {
		const position = hitTestPosition(ev.offsetX, ev.offsetY);
		const color = position && state.activePattern && resolveCurrentColor(position);
		if (!color) { ev.preventDefault(); return; }
		ev.dataTransfer.setData("text/plain", color);
		ev.dataTransfer.effectAllowed = "copy";
		const thumb = buildDragThumbnail(position, color);
		if (thumb) ev.dataTransfer.setDragImage(thumb, thumb.width / 2, thumb.height / 2);
	});

	dom.canvas.addEventListener("dragover", ev => {
		if (hitTestPosition(ev.offsetX, ev.offsetY)) ev.preventDefault();
	});

	dom.canvas.addEventListener("drop", ev => {
		ev.preventDefault();
		const position = hitTestPosition(ev.offsetX, ev.offsetY);
		const color = ev.dataTransfer.getData("text/plain");
		if (position && color) assignPositionColor(position, color);
	});
}
