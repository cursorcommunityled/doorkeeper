#!/usr/bin/env node

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = process.env.OUT_DIR || "/opt/cursor/artifacts";
const PORT = Number(process.env.PORT) || 8765;
const URL = process.env.DEMO_URL || `http://127.0.0.1:${PORT}/?demo=demo/person.webm`;
const DURATION_MS = Number(process.env.DURATION_MS) || 8000;

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});

const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: {
    dir: OUT_DIR,
    size: { width: 1280, height: 720 },
  },
});

const page = await context.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector("canvas#dither");
await page.waitForFunction(() => {
  const canvas = document.querySelector("canvas#dither");
  return canvas && canvas.width > 0 && canvas.height > 0;
}, null, { timeout: 15000 });

// Let dither settle, then trigger a glitch burst for visual interest
await page.waitForTimeout(1500);
await page.keyboard.press("c");
await page.waitForTimeout(Math.max(1000, DURATION_MS - 1500));

const screenshotPath = path.join(OUT_DIR, "tahiti-doorkeeper-frame.png");
await page.screenshot({ path: screenshotPath });

const video = page.video();
await context.close();
await browser.close();

const rawVideoPath = await video.path();
const finalVideoPath = path.join(OUT_DIR, "tahiti-doorkeeper-demo.webm");
fs.renameSync(rawVideoPath, finalVideoPath);

console.log(JSON.stringify({ screenshotPath, finalVideoPath }, null, 2));
