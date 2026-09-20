import { PATTERNS, MANIFEST } from "./data.js";
import { dom } from "./dom.js";
import { MAX_SLOTS } from "./constants.js";
import { renderSlotTray, redraw, renderPatternGrid } from "./render.js";
import { buildHistoryButtonContent } from "./dots.js";

/** Synthetic pattern used while free-form per-keycap coloring is active. Not part
 * of patterns.json (it's a UI-only marker, not board-layout data) - has no `.keys`
 * or `.numColors`, so code that needs to branch on custom mode should check
 * `state.customMode` rather than `state.activePattern === CUSTOM_PATTERN`. */
export const CUSTOM_PATTERN = { id: "custom", name: "Custom" };

/** Currently assigned color name per slot index (0-based), undefined if empty. */
export const state = {
	slotColors: [],
	activePattern: null,
	selectedSwatchColor: null, // for click-to-assign fallback

	// --- Free-form per-keycap coloring ("Custom" mode) ---
	/** @type {Object<string, string>} color name per keycap position, only meaningful when customMode is true */
	positionColors: {},
	customMode: false,

	// --- Randomize exclusion pools ---
	excludedColors: new Set(),
	excludedPatternIds: new Set(),

	// --- History (undo/redo) ---
	/** @type {({custom: false, patternId: string, slotColors: string[]}|{custom: true, positionColors: Object<string,string>})[]} */
	history: [],
	historyIndex: -1
};

const EXCLUSIONS_STORAGE_KEY = "keycaps.excluded.v1";

// --- Core state setter: everything that changes what's on screen goes through this,
// with an explicit choice of whether it becomes a new history entry. ---
export function setState(patternId, colors, { commit }) {
	state.activePattern = PATTERNS.patterns.find(p => p.id === patternId);
	if (!state.activePattern) return;
	state.customMode = false; // picking a real pattern always exits Custom mode
	dom.patternDesc.textContent = state.activePattern.description || "";
	// Keep colors in slots beyond this pattern's numColors around in memory,
	// so they reappear if the user switches to a pattern with more slots later.
	state.slotColors = colors.slice(0, MAX_SLOTS);
	renderSlotTray();
	renderPatternGrid();
	redraw();
	if (commit) commitState();
}

export function assignSlot(slotIndex, color) {
	const next = state.slotColors.slice();
	next[slotIndex] = color;
	setState(state.activePattern.id, next, { commit: true });
}

/** The color currently showing on a given keycap position, whether that's coming
 * from Custom mode's own positionColors or resolved through the active pattern's
 * slot mapping. Used both to seed Custom mode on first use and to read off a
 * keycap's color when dragging it onto another keycap. */
export function resolveCurrentColor(position) {
	if (state.customMode) return state.positionColors[position];
	const slotIndex = state.activePattern.keys[position];
	return state.slotColors[slotIndex];
}

// --- Custom mode counterpart to setState()/assignSlot() ---
export function setCustomState(positionColors, { commit }) {
	state.activePattern = CUSTOM_PATTERN;
	state.customMode = true;
	state.positionColors = positionColors;
	dom.patternDesc.textContent = "Drag colors directly onto keycaps to customize each one individually.";
	renderSlotTray();
	renderPatternGrid();
	redraw();
	if (commit) commitState();
}

/** Entry point for both "drop a swatch onto a keycap" and "drag one keycap's
 * color onto another keycap" - on first use (not yet in Custom mode) it snapshots
 * whatever's currently showing into a full per-position map before overriding the
 * dropped-on position, so the rest of the keyboard doesn't visibly change. */
export function assignPositionColor(position, color) {
	const next = state.customMode ? { ...state.positionColors } : {};
	if (!state.customMode) {
		for (const p of Object.keys(MANIFEST.positions)) next[p] = resolveCurrentColor(p);
	}
	next[position] = color;
	setCustomState(next, { commit: true });
}

/** Enters Custom mode seeded from whatever's currently on screen, without
 * changing any keycap's color - used by the Custom tile's click handler so it's
 * usable before any drag has happened. No-ops if already in Custom mode. */
export function enterCustomMode() {
	if (state.customMode) return;
	const next = {};
	for (const p of Object.keys(MANIFEST.positions)) next[p] = resolveCurrentColor(p);
	setCustomState(next, { commit: true });
}

export function shuffled(arr) {
	const a = arr.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export function randomizeAll() {
	const patternPool = PATTERNS.patterns.filter(p => !state.excludedPatternIds.has(p.id));
	const patterns = patternPool.length ? patternPool : PATTERNS.patterns;
	const pattern = patterns[Math.floor(Math.random() * patterns.length)];

	const colorPool = PATTERNS.availableColors.filter(c => !state.excludedColors.has(c));
	const colors = colorPool.length ? colorPool : PATTERNS.availableColors;

	setState(pattern.id, shuffled(colors), { commit: true });
}

// --- Randomize exclusion pools (persisted) ---
export function loadExclusionsFromStorage() {
	try {
		const raw = localStorage.getItem(EXCLUSIONS_STORAGE_KEY);
		const parsed = raw ? JSON.parse(raw) : {};
		state.excludedColors = new Set(Array.isArray(parsed.colors) ? parsed.colors : []);
		state.excludedPatternIds = new Set(Array.isArray(parsed.patterns) ? parsed.patterns : []);
	} catch (err) {
		state.excludedColors = new Set();
		state.excludedPatternIds = new Set();
	}
}

function saveExclusionsToStorage() {
	try {
		localStorage.setItem(EXCLUSIONS_STORAGE_KEY, JSON.stringify({
			colors: [...state.excludedColors],
			patterns: [...state.excludedPatternIds]
		}));
	} catch (err) {
		// Storage unavailable/full - exclusions just stay session-only for this run.
	}
}

export function toggleColorExcluded(color) {
	if (state.excludedColors.has(color)) state.excludedColors.delete(color);
	else state.excludedColors.add(color);
	saveExclusionsToStorage();
}

export function togglePatternExcluded(patternId) {
	if (state.excludedPatternIds.has(patternId)) state.excludedPatternIds.delete(patternId);
	else state.excludedPatternIds.add(patternId);
	saveExclusionsToStorage();
}

// --- History ---
function snapshotEntry() {
	return state.customMode
		? { custom: true, positionColors: { ...state.positionColors } }
		: { custom: false, patternId: state.activePattern.id, slotColors: state.slotColors.slice() };
}

function sameEntry(a, b) {
	if (a.custom !== b.custom) return false;
	if (a.custom) {
		const aKeys = Object.keys(a.positionColors), bKeys = Object.keys(b.positionColors);
		return aKeys.length === bKeys.length && aKeys.every(p => a.positionColors[p] === b.positionColors[p]);
	}
	return a.patternId === b.patternId
		&& a.slotColors.length === b.slotColors.length
		&& a.slotColors.every((color, i) => color === b.slotColors[i]);
}

export function commitState() {
	const entry = snapshotEntry();
	const current = state.history[state.historyIndex];
	if (current && sameEntry(current, entry)) return; // no-op change, don't duplicate the current entry

	if (state.historyIndex < state.history.length - 1) {
		state.history = state.history.slice(0, state.historyIndex + 1);
	}
	state.history.push(entry);
	state.historyIndex = state.history.length - 1;
	updateHistoryButtons();
}

function restoreEntry(h) {
	if (h.custom) setCustomState(h.positionColors, { commit: false });
	else setState(h.patternId, h.slotColors, { commit: false });
}

export function goBack() {
	if (state.historyIndex <= 0) return;
	state.historyIndex--;
	restoreEntry(state.history[state.historyIndex]);
	updateHistoryButtons();
}

export function goForward() {
	if (state.historyIndex >= state.history.length - 1) return;
	state.historyIndex++;
	restoreEntry(state.history[state.historyIndex]);
	updateHistoryButtons();
}

function entryPattern(entry) {
	return entry.custom ? CUSTOM_PATTERN : PATTERNS.patterns.find(p => p.id === entry.patternId);
}

export function updateHistoryButtons() {
	const canGoBack = state.historyIndex > 0;
	const canGoForward = state.historyIndex < state.history.length - 1;
	dom.backBtn.disabled = !canGoBack;

	const backEntry = canGoBack ? state.history[state.historyIndex - 1] : null;
	buildHistoryButtonContent(dom.backBtn, backEntry, backEntry && entryPattern(backEntry));

	if (canGoForward) {
		const forwardEntry = state.history[state.historyIndex + 1];
		if (!dom.forwardBtn.isConnected) dom.toolbar.appendChild(dom.forwardBtn);
		dom.forwardBtn.disabled = false;
		buildHistoryButtonContent(dom.forwardBtn, forwardEntry, entryPattern(forwardEntry));
	} else {
		dom.forwardBtn.remove();
	}
}
