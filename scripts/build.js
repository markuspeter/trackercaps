#!/usr/bin/env node
"use strict";

// Packs src/ (the ES-module rewrite of gui/) into dist/ for publishing: bundles the
// whole js/ module graph into one file via esbuild, then copies index.html, styles.css,
// and the data/asset files verbatim (esbuild only touches the JS it bundles).
//
// Usage:
//   node scripts/build.js
//
// Output: dist/ (index.html, styles.css, js/main.js + .map, data/, assets/).

const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const projectRoot = path.resolve(__dirname, "..");
const srcDir = path.join(projectRoot, "src");
const distDir = path.join(projectRoot, "dist");

async function main() {
	fs.rmSync(distDir, { recursive: true, force: true });
	fs.mkdirSync(distDir, { recursive: true });

	await esbuild.build({
		entryPoints: [path.join(srcDir, "js", "main.js")],
		bundle: true,
		format: "esm",
		outfile: path.join(distDir, "js", "main.js"),
		minify: true,
		sourcemap: true
	});

	fs.copyFileSync(path.join(srcDir, "index.html"), path.join(distDir, "index.html"));
	fs.copyFileSync(path.join(srcDir, "styles.css"), path.join(distDir, "styles.css"));
	fs.cpSync(path.join(srcDir, "data"), path.join(distDir, "data"), { recursive: true });
	fs.cpSync(path.join(srcDir, "assets"), path.join(distDir, "assets"), { recursive: true });

	const bundleSize = fs.statSync(path.join(distDir, "js", "main.js")).size;
	const assetCount = countFiles(path.join(distDir, "assets")) + countFiles(path.join(distDir, "data"));
	console.log(`Built dist/ from src/`);
	console.log(`  js/main.js: ${(bundleSize / 1024).toFixed(1)} KB (minified, bundled)`);
	console.log(`  copied ${assetCount} data/asset files verbatim`);
}

function countFiles(dir) {
	let count = 0;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		count += entry.isDirectory() ? countFiles(full) : 1;
	}
	return count;
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
