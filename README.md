# Cursor Event Greeting Screens

A collection of simple, TV-ready greeting screens for Cursor community events.

Each screen lives in its own folder as plain HTML, CSS, and JavaScript — no build step.

## Screens

| Folder | Description |
| --- | --- |
| [`dithered-camera/`](./dithered-camera) | Black-and-white dithered camera feed with Cursor branding, motion trails, and a short glitch burst when someone says “Cursor” |
| [`tahiti-meetup/`](./tahiti-meetup) | Tahiti Meetup greeting screen (CursorDisplay wordmark + demo video mode via `?demo`) |

## Setup

```bash
npm install
```

## Run a screen

```bash
npm run screen -- <screen-folder>
```

Example:

```bash
npm run screen -- dithered-camera
```

This starts a local server on [http://localhost:8765](http://localhost:8765) and opens the screen in your browser.

> Camera and microphone features need this local server (not `file://`).

Override the port with:

```bash
PORT=3000 npm run screen -- dithered-camera
```

## Add a new screen

1. Create a new folder at the repo root (for example `my-screen/`).
2. Add `index.html` plus any CSS, JS, and assets the screen needs.
3. Keep it self-contained so it can run from the static server.
4. List it in the **Screens** table above.
5. Run it with `npm run screen -- my-screen`.

## Notes

- Designed for fullscreen display on a TV or projector.
- Prefer offline-friendly assets (fonts, logos) so event Wi‑Fi is not required for rendering.
- Browser permission prompts may appear for camera and microphone depending on the screen.
