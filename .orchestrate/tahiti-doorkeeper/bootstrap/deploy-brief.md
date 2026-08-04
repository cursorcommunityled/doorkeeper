# Tahiti Meetup Doorkeeper — deployment brief

Reference for deploy/verify workers. Do not re-discover; follow this spec.

## Goal

Deploy the `tahiti-meetup/` static greeting screen to Cloudflare so a **public HTTPS URL** prompts for camera access on click, runs the live dithered camera feed, and enables microphone for speech-triggered glitch effects.

## Repo

- **URL:** https://github.com/cursorcommunityled/doorkeeper
- **Branch:** `cursor/tahiti-meetup-doorkeeper-bb91`
- **Screen path:** `tahiti-meetup/` (plain HTML/CSS/JS, no build step)

## Screen behavior

- `index.html` + `script.js` + `styles.css` + `assets/` (logo, fonts)
- On load/click: requests camera via `getUserMedia` (HTTPS required — Cloudflare provides this)
- After camera starts: starts Web Speech API for mic; saying "Cursor" triggers glitch burst
- Demo mode (no camera): append `?demo` to URL — plays `demo/person.webm` instead
- Fullscreen: double-click or press `F`

## Cloudflare target

- **Account ID:** `dfde833d0b10b91136eb621f0b71c687`
- **Auth:** `CLOUDFLARE_API_TOKEN` env var (already injected in cloud-agent VM)
- **Deploy method:** Workers Assets (static site, no custom worker logic needed)

### Minimal wrangler.jsonc

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "tahiti-meetup-doorkeeper",
  "compatibility_date": "2026-02-01",
  "assets": {
    "directory": "./tahiti-meetup",
    "html_handling": "auto-trailing-slash",
    "not_found_handling": "404-page"
  }
}
```

### Deploy commands

```bash
npm install -D wrangler@latest
npx wrangler whoami   # verify token
npx wrangler deploy --account-id dfde833d0b10b91136eb621f0b71c687
```

The deploy output includes the live `*.workers.dev` URL. Record it in the handoff.

## Verification checklist

1. URL loads over HTTPS (200)
2. Page shows "Click to enable camera" hint
3. Click triggers browser camera permission prompt
4. After granting: dithered B&W canvas animates with live feed
5. Mic permission may follow; saying "cursor" triggers visual glitch

Use Playwright or browser MCP for headless checks where possible; demo mode (`?demo`) works without real camera for CI-style verification.

## Google Drive update

- **Folder:** https://drive.google.com/drive/folders/12ZLC8K2zYcn36tMVUgm1hNuJ7rDkVo7V
- Add a Google Doc or text file named `LIVE-URL.txt` (or similar) containing the deployed HTTPS URL
- Use Google Drive MCP tools (`create_file`, `update_file`, or `share_file`)

## PR

- Base branch for workers: `cursor/tahiti-meetup-doorkeeper-bb91`
- Commit wrangler config + any deploy artifacts to the worker branch
- Open or update a draft PR against `cursor/tahiti-meetup-doorkeeper-bb91` (or `main` if instructed via `openPR`)
