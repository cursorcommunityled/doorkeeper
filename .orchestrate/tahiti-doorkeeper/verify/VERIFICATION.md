# deploy-cloudflare verification log

**Target:** `deploy-cloudflare` on `orch/tahiti-doorkeeper/deploy-cloudflare`  
**Live URL:** https://tahiti-meetup-doorkeeper.pf-container-routes.workers.dev  
**Demo URL:** https://tahiti-meetup-doorkeeper.pf-container-routes.workers.dev/?demo  
**Verified at:** 2026-08-04T05:18Z

## curl results

| Check | Result |
|-------|--------|
| `curl -sI /` | HTTP 200, content-type text/html, server cloudflare |
| Branding | `<title>Cursor Tahiti Meetup</title>`, `CURSOR`, `Tahiti Meetup` |
| `/script.js` | 200 |
| `/styles.css` | 200 |
| `/assets/cursor-logo.png` | 200 |
| `/assets/fonts/*.woff2` | 200 (3 fonts) |
| `/demo/person.webm` | 200, content-type video/webm |
| `/?demo` | 200 |

Note: `/assets/` directory listing returns 404 (expected; individual files serve correctly).

## Playwright browser verification

### Demo mode (`?demo`)
- Page title: "Cursor Tahiti Meetup"
- Brand/subtitle present
- Demo video loads from `/demo/person.webm`
- Canvas sized 720×405 with B&W dither pixels (black: 268385, white: 23215)
- Canvas checksum changed over 1.5s → dither animation confirmed
- Screenshot: `demo-mode-screenshot.png`

### Camera mode (no `?demo`)
- Page auto-invokes `getUserMedia` on load (script.js line 425)
- Click also invokes `getUserMedia` (retry path)
- Constraints: `{ audio: false, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } }`
- Without permission: hint shows "Camera blocked — allow access, then click again"
- Real camera hardware unavailable in headless CI; permission prompt UX verified via getUserMedia interception
- Screenshot: `camera-blocked-screenshot.png`

## Verdict

**PASS** — All automated acceptance criteria met. Demo mode fully verified with live dither animation. Camera path verified to invoke getUserMedia on load/click; live hardware camera feed not testable in this environment.
