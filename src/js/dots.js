import { COLOR_HEX } from "./constants.js";

export function buildColorDots(slotColors) {
	const dots = document.createElement("div");
	dots.className = "favorite-dots";
	for (const color of slotColors) {
		const dot = document.createElement("span");
		dot.className = "favorite-dot";
		dot.style.background = COLOR_HEX[color] || "#888";
		dots.appendChild(dot);
	}
	return dots;
}

/** Content for a history (undo/redo) button: a dot row plus the target pattern's
 * name, truncated visually with the full name available via the button's title. */
export function buildHistoryButtonContent(button, historyEntry, pattern) {
	button.innerHTML = "";
	if (!historyEntry) {
		button.title = "";
		const placeholder = document.createElement("div");
		placeholder.className = "history-btn-empty";
		button.appendChild(placeholder);
		return;
	}
	button.title = pattern ? pattern.name : historyEntry.patternId;
	const dotColors = historyEntry.custom
		? [...new Set(Object.values(historyEntry.positionColors))]
		: historyEntry.slotColors;
	button.appendChild(buildColorDots(dotColors));
	const name = document.createElement("div");
	name.className = "history-btn-name";
	name.textContent = pattern ? pattern.name : historyEntry.patternId;
	button.appendChild(name);
}
