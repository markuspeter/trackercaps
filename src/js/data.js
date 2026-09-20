export let MANIFEST = null;
export let PATTERNS = null;

export async function loadData() {
	const [manifestRes, patternsRes] = await Promise.all([
		fetch("./data/manifest.json"),
		fetch("./data/patterns.json")
	]);
	MANIFEST = await manifestRes.json();
	PATTERNS = await patternsRes.json();
}
