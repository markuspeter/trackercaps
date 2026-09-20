import { dom, sizeCanvas } from "./dom.js";
import { loadData, MANIFEST, PATTERNS } from "./data.js";
import { preloadAll } from "./assets.js";
import { buildPatternGrid, buildSwatchTray, buildSlotTray } from "./ui.js";
import { setState, randomizeAll, goBack, goForward, updateHistoryButtons, loadExclusionsFromStorage } from "./state.js";
import { loadFavoritesFromStorage, renderFavorites, addFavorite } from "./favorites.js";
import { downloadPng } from "./export.js";
import { initCanvasDragDrop } from "./canvas-dnd.js";

async function init() {
	await loadData();
	sizeCanvas(MANIFEST.canvasSize);

	loadExclusionsFromStorage();
	buildPatternGrid();
	buildSwatchTray();
	buildSlotTray();
	loadFavoritesFromStorage();
	renderFavorites();
	updateHistoryButtons();
	initCanvasDragDrop();

	dom.downloadBtn.addEventListener("click", downloadPng);
	dom.randomizeBtn.addEventListener("click", randomizeAll);
	dom.backBtn.addEventListener("click", goBack);
	dom.forwardBtn.addEventListener("click", goForward);
	dom.addFavoriteBtn.addEventListener("click", addFavorite);

	dom.statusEl.textContent = "Loading images…";
	try {
		await preloadAll();
		dom.statusEl.textContent = "";
		dom.downloadBtn.disabled = false;
	} catch (err) {
		dom.statusEl.textContent = "Error loading assets: " + err.message;
		console.error(err);
	}

	if (PATTERNS.patterns.length > 0) {
		const first = PATTERNS.patterns[0];
		setState(first.id, PATTERNS.availableColors, { commit: true });
	}
}

init();
