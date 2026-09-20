import { dom } from "./dom.js";
import { state } from "./state.js";
import { images } from "./assets.js";
import { MANIFEST, PATTERNS } from "./data.js";
import { SWATCH_DIR, COLOR_HEX } from "./constants.js";

/** Schematic SVG shell shared by every pattern-grid tile preview (including the
 * Custom tile): a light background plus one rounded rect per key position, sized/
 * placed from the real bbox layout. `fillForPosition(position)` supplies each
 * rect's color, or `null`/`undefined` to skip drawing that key entirely. */
function buildKeycapPreviewSvg(fillForPosition) {
	const svgNS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(svgNS, "svg");
	svg.setAttribute("viewBox", `0 0 ${MANIFEST.canvasSize[0]} ${MANIFEST.canvasSize[1]}`);
	svg.classList.add("pattern-preview-svg");

	const bg = document.createElementNS(svgNS, "rect");
	bg.setAttribute("x", 0);
	bg.setAttribute("y", 0);
	bg.setAttribute("width", MANIFEST.canvasSize[0]);
	bg.setAttribute("height", MANIFEST.canvasSize[1]);
	bg.setAttribute("fill", "#eef0f3");
	svg.appendChild(bg);

	for (const [position, byColor] of Object.entries(MANIFEST.positions)) {
		const fill = fillForPosition(position);
		if (!fill) continue;
		const anyColorInfo = Object.values(byColor)[0];
		if (!anyColorInfo) continue;
		const [x, y, w, h] = anyColorInfo.bbox;

		const rect = document.createElementNS(svgNS, "rect");
		rect.setAttribute("x", x);
		rect.setAttribute("y", y);
		rect.setAttribute("width", w);
		rect.setAttribute("height", h);
		rect.setAttribute("rx", 24);
		rect.setAttribute("fill", fill);
		svg.appendChild(rect);
	}
	return svg;
}

/** Schematic preview for a real pattern tile. Colors come from COLOR_HEX (not the
 * real swatch photos - those aren't chosen yet when browsing patterns) for the
 * first 4 entries of PATTERNS.availableColors, one per slot index. Computed inside
 * the function (not at module scope) since PATTERNS is still null when this module
 * is first evaluated, before main.js's loadData() resolves. */
export function buildPatternPreview(pattern) {
	const previewColors = PATTERNS.availableColors.slice(0, 4).map(c => COLOR_HEX[c]);
	return buildKeycapPreviewSvg(position => {
		const slotIndex = pattern.keys[position];
		return slotIndex === undefined ? null : previewColors[slotIndex % previewColors.length];
	});
}

/** Preview for the Custom tile: reflects the real per-keycap colors currently
 * assigned (state.positionColors), or a uniform neutral placeholder before the
 * user has customized anything this session. */
export function buildCustomTilePreview() {
	const hasCustomized = Object.keys(state.positionColors).length > 0;
	return buildKeycapPreviewSvg(position => {
		const color = state.positionColors[position];
		return hasCustomized ? (COLOR_HEX[color] || "#cbd0d8") : "#cbd0d8";
	});
}

export function renderPatternGrid() {
	if (!dom.patternGrid || !state.activePattern) return;
	for (const tile of dom.patternGrid.children) {
		tile.classList.toggle("active", tile.dataset.patternId === state.activePattern.id);
	}
	const customTile = dom.patternGrid.querySelector('[data-pattern-id="custom"]');
	if (customTile) {
		const oldPreview = customTile.querySelector(".pattern-preview-svg");
		oldPreview.replaceWith(buildCustomTilePreview());
	}
}

export function renderSlotTray() {
	const slotEls = dom.slotTray.querySelectorAll(".slot");
	let message = dom.slotTray.querySelector(".slot-tray-message");
	if (state.customMode) {
		if (!message) {
			message = document.createElement("div");
			message.className = "slot-tray-message";
			message.textContent = "Drag colors directly onto keycaps in the preview to customize each one.";
			dom.slotTray.appendChild(message);
		}
		dom.slotTray.classList.add("custom-active");
		slotEls.forEach(div => {
			div.classList.add("disabled");
			div.classList.remove("filled");
			div.querySelector(".slot-content").innerHTML = "";
		});
		return;
	}
	if (message) message.remove();
	dom.slotTray.classList.remove("custom-active");
	slotEls.forEach((div, i) => {
		const content = div.querySelector(".slot-content");
		const active = i < state.activePattern.numColors;
		div.classList.toggle("disabled", !active);
		const color = state.slotColors[i];
		if (active && color) {
			div.classList.add("filled");
			content.innerHTML = "";
			const img = document.createElement("img");
			img.src = SWATCH_DIR + color + ".png";
			img.alt = color;
			img.title = color; // name shown as tooltip only - text labels crowd the small slot
			content.appendChild(img);
		} else {
			div.classList.remove("filled");
			content.innerHTML = active ? '<div class="placeholder">Drop a color here</div>' : "";
		}
	});
}

export function redraw() {
	const canvas = dom.canvas;
	const ctx = dom.ctx;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	const bg = images.get("background");
	if (bg) ctx.drawImage(bg, 0, 0);

	if (!state.activePattern) return;
	for (const [position, byColor] of Object.entries(MANIFEST.positions)) {
		const color = state.customMode
			? state.positionColors[position]
			: state.slotColors[state.activePattern.keys[position]];
		if (!color) continue;
		const info = byColor[color];
		if (!info) continue;
		const img = images.get(position + "_" + color);
		if (!img) continue;
		const x = Math.round(info.bbox[0] + info.shift[0]);
		const y = Math.round(info.bbox[1] + info.shift[1]);
		ctx.drawImage(img, x, y);
	}
}
