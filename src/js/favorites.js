import { dom } from "./dom.js";
import { state, setState, setCustomState, CUSTOM_PATTERN } from "./state.js";
import { PATTERNS } from "./data.js";
import { buildColorDots } from "./dots.js";

// --- Favorites (persisted via localStorage) ---
const STORAGE_KEY = "keycaps.favorites.v1";
/** @type {({id: number, custom: false, patternId: string, slotColors: string[]}|{id: number, custom: true, positionColors: Object<string,string>})[]} */
let list = [];
let nextId = 1;

export function loadFavoritesFromStorage() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		list = Array.isArray(parsed) ? parsed : [];
	} catch (err) {
		list = [];
	}
	nextId = list.reduce((max, f) => Math.max(max, f.id + 1), 1);
}

export function saveFavoritesToStorage() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
	} catch (err) {
		// Storage unavailable/full - favorites just stay session-only for this run.
	}
}

export function addFavorite() {
	if (!state.activePattern) return;
	const fav = state.customMode
		? { id: nextId++, custom: true, positionColors: { ...state.positionColors } }
		: { id: nextId++, custom: false, patternId: state.activePattern.id, slotColors: state.slotColors.slice(0, state.activePattern.numColors) };
	list.push(fav);
	saveFavoritesToStorage();
	renderFavorites();
}

export function removeFavorite(id) {
	list = list.filter(f => f.id !== id);
	saveFavoritesToStorage();
	renderFavorites();
}

export function loadFavorite(fav) {
	if (fav.custom) setCustomState(fav.positionColors, { commit: true });
	else setState(fav.patternId, fav.slotColors, { commit: true });
}

export function renderFavorites() {
	const favoritesList = dom.favoritesList;
	favoritesList.innerHTML = "";
	if (list.length === 0) {
		favoritesList.innerHTML = '<div class="favorites-empty">No favorites yet - click "★ Add current to favorites" to save this look.</div>';
		return;
	}
	for (const fav of list) {
		const pattern = fav.custom ? CUSTOM_PATTERN : PATTERNS.patterns.find(p => p.id === fav.patternId);
		const item = document.createElement("div");
		item.className = "favorite-item";

		const dotColors = fav.custom ? [...new Set(Object.values(fav.positionColors))] : fav.slotColors;
		item.appendChild(buildColorDots(dotColors));

		const name = document.createElement("span");
		name.className = "favorite-name";
		name.textContent = pattern ? pattern.name : fav.patternId;
		item.appendChild(name);

		const removeBtn = document.createElement("button");
		removeBtn.className = "favorite-remove";
		removeBtn.textContent = "✕";
		removeBtn.title = "Remove favorite";
		removeBtn.addEventListener("click", ev => {
			ev.stopPropagation();
			removeFavorite(fav.id);
		});
		item.appendChild(removeBtn);

		item.addEventListener("click", () => loadFavorite(fav));

		favoritesList.appendChild(item);
	}
}
