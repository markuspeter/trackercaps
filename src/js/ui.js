import { dom } from "./dom.js";
import { PATTERNS } from "./data.js";
import { state, assignSlot, setState, toggleColorExcluded, togglePatternExcluded, CUSTOM_PATTERN, enterCustomMode } from "./state.js";
import { MAX_SLOTS, SWATCH_DIR } from "./constants.js";
import { buildPatternPreview, buildCustomTilePreview } from "./render.js";

function buildExcludeToggle(isExcluded, onToggle) {
	const btn = document.createElement("button");
	btn.className = "exclude-toggle";
	btn.type = "button";
	btn.title = isExcluded() ? "Include in randomize" : "Exclude from randomize";
	btn.textContent = "🚫";
	btn.addEventListener("click", ev => {
		ev.stopPropagation();
		onToggle();
		const excluded = isExcluded();
		btn.parentElement.classList.toggle("excluded", excluded);
		btn.title = excluded ? "Include in randomize" : "Exclude from randomize";
	});
	return btn;
}

export function buildPatternGrid() {
	const patternGrid = dom.patternGrid;
	patternGrid.innerHTML = "";
	for (const pattern of PATTERNS.patterns) {
		const tile = document.createElement("div");
		tile.className = "pattern-tile";
		tile.dataset.patternId = pattern.id;
		if (state.excludedPatternIds.has(pattern.id)) tile.classList.add("excluded");

		tile.appendChild(buildPatternPreview(pattern));

		const name = document.createElement("div");
		name.className = "pattern-name";
		name.textContent = pattern.name;
		tile.appendChild(name);

		tile.appendChild(buildExcludeToggle(
			() => state.excludedPatternIds.has(pattern.id),
			() => togglePatternExcluded(pattern.id)
		));

		tile.addEventListener("click", () => {
			setState(pattern.id, state.slotColors, { commit: true });
		});

		patternGrid.appendChild(tile);
	}

	const customTile = document.createElement("div");
	customTile.className = "pattern-tile";
	customTile.dataset.patternId = CUSTOM_PATTERN.id;
	customTile.appendChild(buildCustomTilePreview());
	const customName = document.createElement("div");
	customName.className = "pattern-name";
	customName.textContent = CUSTOM_PATTERN.name;
	customTile.appendChild(customName);
	customTile.addEventListener("click", enterCustomMode);
	patternGrid.appendChild(customTile);
}

export function buildSwatchTray() {
	const swatchTray = dom.swatchTray;
	swatchTray.innerHTML = "";
	for (const color of PATTERNS.availableColors) {
		const div = document.createElement("div");
		div.className = "swatch";
		div.draggable = true;
		div.dataset.color = color;
		div.title = color;
		if (state.excludedColors.has(color)) div.classList.add("excluded");

		const img = document.createElement("img");
		img.src = SWATCH_DIR + color + ".png";
		img.alt = color;
		div.appendChild(img);

		div.appendChild(buildExcludeToggle(
			() => state.excludedColors.has(color),
			() => toggleColorExcluded(color)
		));

		div.addEventListener("dragstart", ev => {
			ev.dataTransfer.setData("text/plain", color);
			ev.dataTransfer.effectAllowed = "copy";
		});
		div.addEventListener("click", () => {
			swatchTray.querySelectorAll(".swatch").forEach(s => s.classList.remove("selected"));
			if (state.selectedSwatchColor === color) {
				state.selectedSwatchColor = null; // toggle off
			} else {
				state.selectedSwatchColor = color;
				div.classList.add("selected");
			}
		});

		swatchTray.appendChild(div);
	}
}

export function buildSlotTray() {
	const slotTray = dom.slotTray;
	slotTray.innerHTML = "";
	for (let i = 0; i < MAX_SLOTS; i++) {
		const div = document.createElement("div");
		div.className = "slot";
		div.dataset.slot = String(i);

		const indexLabel = document.createElement("div");
		indexLabel.className = "slot-index";
		indexLabel.textContent = String(i + 1);
		div.appendChild(indexLabel);

		const content = document.createElement("div");
		content.className = "slot-content";
		div.appendChild(content);

		div.addEventListener("dragover", ev => {
			if (div.classList.contains("disabled")) return;
			ev.preventDefault();
			div.classList.add("dragover");
		});
		div.addEventListener("dragleave", () => div.classList.remove("dragover"));
		div.addEventListener("drop", ev => {
			ev.preventDefault();
			div.classList.remove("dragover");
			if (div.classList.contains("disabled")) return;
			const color = ev.dataTransfer.getData("text/plain");
			if (color) assignSlot(i, color);
		});
		div.addEventListener("click", () => {
			if (div.classList.contains("disabled")) return;
			if (state.selectedSwatchColor) assignSlot(i, state.selectedSwatchColor);
		});

		slotTray.appendChild(div);
	}
}
