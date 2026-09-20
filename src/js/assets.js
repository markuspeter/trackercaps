import { MANIFEST, PATTERNS } from "./data.js";
import { BACKGROUND_PATH, TILES_DIR } from "./constants.js";

/** @type {Map<string, HTMLImageElement>} keyed by "background" or "{position}_{color}" */
export const images = new Map();

export function loadImage(key, src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => { images.set(key, img); resolve(); };
		img.onerror = () => reject(new Error("Failed to load " + src));
		img.src = src;
	});
}

export async function preloadAll() {
	const tasks = [loadImage("background", BACKGROUND_PATH)];
	for (const position of MANIFEST.positions ? Object.keys(MANIFEST.positions) : []) {
		for (const color of PATTERNS.availableColors) {
			const key = position + "_" + color;
			tasks.push(loadImage(key, TILES_DIR + key + ".png"));
		}
	}
	await Promise.all(tasks);
}
