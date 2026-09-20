#!/usr/bin/env node
"use strict";

// Minimal zero-dependency static file server for src/ (the ES-module rewrite of gui/).
// Exists only to give src/ a same-origin http:// context, which is what unlocks
// <script type="module">, fetch() of local .json files, and canvas-drawing of local
// <img>s without the file:// tainting/blocking issues gui/ works around - see
// src/index.html's top comment and CLAUDE.md.
//
// Usage:
//   node scripts/dev-server.js [port]
//
// port defaults to 8080, or the PORT env var if set. No live-reload/HMR - just
// refresh the browser after editing files.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const projectRoot = path.resolve(__dirname, "..");
const root = path.join(projectRoot, "src");
const port = Number(process.argv[2] || process.env.PORT || 8080);

const MIME_TYPES = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml"
};

function send(res, status, body, headers) {
	res.writeHead(status, Object.assign({ "Cache-Control": "no-store" }, headers));
	res.end(body);
}

const server = http.createServer((req, res) => {
	let pathname;
	try {
		pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
	} catch (err) {
		send(res, 400, "Bad request");
		return;
	}
	if (pathname === "/") pathname = "/index.html";

	const resolved = path.join(root, pathname);
	if (resolved !== root && !resolved.startsWith(root + path.sep)) {
		send(res, 404, "Not found");
		return;
	}

	const ext = path.extname(resolved).toLowerCase();
	const contentType = MIME_TYPES[ext] || "application/octet-stream";

	const stream = fs.createReadStream(resolved);
	stream.on("open", () => {
		res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
		stream.pipe(res);
	});
	stream.on("error", err => {
		if (err.code === "ENOENT") {
			send(res, 404, "Not found: " + pathname);
		} else {
			send(res, 500, "Server error: " + err.message);
		}
	});
});

server.listen(port, () => {
	console.log(`Dev server running at http://localhost:${port}/ (serving ${path.relative(projectRoot, root)}/)`);
});
