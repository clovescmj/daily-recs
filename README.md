# Daily Recs for Bandcamp

New music every day, built from your own taste.

A Chrome extension that adds a **daily recs** tab to your Bandcamp profile: a fresh list of albums picked from what you own and what you've saved, never repeating and never showing what you already have.

## Install
1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this folder.
3. Sign in to bandcamp.com as usual (the extension uses your existing session and never sees your password).
4. Open your profile: a **daily recs** tab appears next to collection / wishlist / followers. The toolbar icon takes you there (and asks you to sign in first if needed).

## How it works
- Starts from what you own and what you've saved on Bandcamp.
- Finds albums that fans of those records love, and keeps the ones that fit your taste.
- Shows only what's new to you: nothing you own, nothing repeated.
- The **heart** adds an album to your Bandcamp wishlist. The **⊘** says "don't show music like this": that album, its artist and the albums Bandcamp pairs with it stop coming.
- **My tags:** discover other music based on your favorite genres.
- **Best matches:** discover new music based on your collection.
- **Surprise me:** music that goes beyond your collection: explore similar music and genres.

## Project layout
```
manifest.json            MV3 manifest (kept at the root: load this folder unpacked)
icons/                   extension icons: app-*.png (extensions page, favicon, store) and the toolbar pair
                         icon-*.png (dark symbol) / dark/icon-*.png (white symbol, for dark toolbars)
design/                  sources of the symbol (SVG); the icons and store images are generated from these
store/                   Chrome Web Store: LISTING.md (texts to paste) and images/ (icon, promo tile, banner)
src/
  lib/                   pure logic, no Chrome APIs except where noted
    bandcamp.js          Bandcamp requests and HTML parsing (retry, rate limits, pagination)
    ranking.js           scoring, one-per-artist picking, surprise mode
    recommender.js       refresh / feedback use cases (store + fetch injected)
    taste-sync.js        hidden albums <-> chrome.storage.sync (chunked, last-write-wins)
    state.js, messages.js, storage-keys.js, config.js
  background/            service worker (registers every listener synchronously at top level)
    service-worker.js    entry point
    jobs.js, messages.js, storage.js, navigation.js, menu.js, wishlist-in-page.js
  content/               tab injected into the user's own Bandcamp profile
  player/                Bandcamp-style player bar (classic script + CSS)
  pages/
    recs/                the recommendations page (ES modules, one concern per file; main.js wires them)
    about/, shared/
  assets/                player sprite and busy animation
test/                    node:test suites with an offline fake Bandcamp
CHANGELOG.md, PRIVACY.md  history by version, and the privacy policy the store links to
```

## Development
```bash
npm test          # offline tests (Node 20+), no network, no browser
npm run check     # syntax check of every source file
npm run package   # zip for the Chrome Web Store (excludes tests and dev files)
```
After changing `manifest.json`, reload the extension in `chrome://extensions`.

## Design notes
- **Service worker:** listeners are registered synchronously at top level; long work is queued and never relies on in-memory state. Run progress lives in `chrome.storage.session`, so a worker killed mid-run can't leave the page "loading" forever.
- **Messages:** every message is parsed strictly and the sender is checked: only the content script (on bandcamp.com) may ask for a wishlist change; everything else must come from the extension's own pages.
- **Storage:** big state in `storage.local` (written twice per run); hidden albums in `storage.sync`, chunked to stay inside the quota.
- **Privacy:** see [PRIVACY.md](PRIVACY.md).
