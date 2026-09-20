import { dom } from "./dom.js";
import { state } from "./state.js";

export function downloadPng() {
	dom.canvas.toBlob(blob => {
		if (!blob) { dom.statusEl.textContent = "Export failed."; return; }
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `keycaps_${state.activePattern ? state.activePattern.id : "export"}.png`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 5000);
	}, "image/png");
}
