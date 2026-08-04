#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const path = require("path");
const { exec } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 8765;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
  ".map": "application/json",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
};

function listScreens() {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.isDirectory()) {
        return false;
      }

      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "scripts") {
        return false;
      }

      return fs.existsSync(path.join(ROOT, entry.name, "index.html"));
    })
    .map((entry) => entry.name)
    .sort();
}

function printUsage(message) {
  if (message) {
    console.error(`${message}\n`);
  }

  const screens = listScreens();
  console.error("Usage: npm run screen -- <screen-folder>");
  console.error("");
  console.error("Available screens:");

  if (screens.length === 0) {
    console.error("  (none found)");
  } else {
    for (const screen of screens) {
      console.error(`  - ${screen}`);
    }
  }

  process.exit(1);
}

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function openBrowser(url) {
  const platform = process.platform;
  const command =
    platform === "darwin"
      ? `open "${url}"`
      : platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;

  exec(command, () => {});
}

function createServer(screenDir) {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${PORT}`);
    let pathname = decodeURIComponent(url.pathname);

    if (pathname === "/") {
      pathname = "/index.html";
    }

    const filePath = path.normalize(path.join(screenDir, pathname));

    if (!filePath.startsWith(screenDir)) {
      send(res, 403, "Forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        send(res, error.code === "ENOENT" ? 404 : 500, error.code === "ENOENT" ? "Not found" : "Server error");
        return;
      }

      send(res, 200, data, {
        "Content-Type": contentType(filePath),
        "Cache-Control": "no-store",
      });
    });
  });
}

const screenName = process.argv[2];

if (!screenName) {
  printUsage("Missing screen folder name.");
}

if (screenName.includes("/") || screenName.includes("\\") || screenName === ".." || screenName === ".") {
  printUsage(`Invalid screen name: ${screenName}`);
}

const screenDir = path.resolve(ROOT, screenName);

if (!fs.existsSync(screenDir) || !fs.statSync(screenDir).isDirectory()) {
  printUsage(`Screen folder not found: ${screenName}`);
}

if (!fs.existsSync(path.join(screenDir, "index.html"))) {
  printUsage(`No index.html in screen folder: ${screenName}`);
}

const server = createServer(screenDir);
const url = `http://localhost:${PORT}/`;

server.listen(PORT, () => {
  console.log(`Serving "${screenName}" at ${url}`);
  console.log("Press Ctrl+C to stop");
  openBrowser(url);
});
