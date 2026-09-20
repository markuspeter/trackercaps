import { DISPLAY_SCALE } from "./constants.js";

export const dom = {
	canvas: document.getElementById("canvas"),
	patternGrid: document.getElementById("patternGrid"),
	patternDesc: document.getElementById("patternDesc"),
	slotTray: document.getElementById("slotTray"),
	swatchTray: document.getElementById("swatchTray"),
	downloadBtn: document.getElementById("downloadBtn"),
	randomizeBtn: document.getElementById("randomizeBtn"),
	statusEl: document.getElementById("status"),
	toolbar: document.getElementById("toolbar"),
	backBtn: document.getElementById("backBtn"),
	forwardBtn: document.getElementById("forwardBtn"),
	addFavoriteBtn: document.getElementById("addFavoriteBtn"),
	favoritesList: document.getElementById("favoritesList")
};
dom.ctx = dom.canvas.getContext("2d");

/** Sizes the canvas backing store to full resolution (accurate PNG export) while
 * scaling down the on-screen CSS display size. Must be called after MANIFEST loads. */
export function sizeCanvas(canvasSize) {
	dom.canvas.width = canvasSize[0];
	dom.canvas.height = canvasSize[1];
	dom.canvas.style.width = Math.round(dom.canvas.width * DISPLAY_SCALE) + "px";
}
