# Daily Recs for Bandcamp

Fresh album recommendations every day, based on your Bandcamp collection and wishlist. It never shows anything you already own (collection, wishlist, or other albums by artists you own), and nothing repeats.

## Install
1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this folder.
3. Sign in to bandcamp.com as usual (the extension uses your existing session and never sees your password).
4. Open your profile: a **daily recs** tab appears next to collection / wishlist / followers. The toolbar icon opens the same page on its own.

## How it works
- Reads your collection and wishlist. Purchases count a little more than saved albums, albums you like here count the most, and recent items count more than old ones.
- The first visit of each day picks random albums of yours, reads each one's "you may also like" section, ranks the results by how many of your albums point to them, how many fans they have in common, and how close their genre tags (read from the top ~80 candidates) are to the taste profile built from your own albums, and shows **50** (one per artist). There is no stockpile: every run builds a fresh batch.
- **♥ (wishlist) / ⊘ (don't show again)** are the taste thermometer. The heart adds the album to your Bandcamp wishlist (click again to remove it, which only returns that album's weight to neutral) and boosts what came from the same source albums; “Don't show this album again” (circle with a slash) hides it, removes it from your wishlist if it was there, and steers away from similar albums; click it again to undo until you reload. Both are used by **Surprise me** and the next days, and sync through your Google account.
- Wishlist changes run Bandcamp's own code inside the Daily Recs tab on your profile.
- **Surprise me** (one button at the top) reads new source albums and builds a second list of 50 from deeper in the ranking, away from the obvious. It is only built when you ask, once a day. The button then becomes **Best matches**, which switches back to the first list instantly; both stay saved until the next day.
- The player at the bottom copies Bandcamp's own, plus shuffle, skip-to-next-album, ±15s, a queue panel, and a wishlist heart.

## Project layout
```
manifest.json            MV3 manifest (kept at the root: load this folder unpacked)
icons/                   toolbar / store icons
src/
  lib/                   pure logic, no Chrome APIs except where noted
    bandcamp.js          Bandcamp requests and HTML parsing (retry, rate limits, pagination)
    ranking.js           scoring, one-per-artist picking, surprise mode
    recommender.js       refresh / feedback use cases (store + fetch injected)
    taste-sync.js        likes/dislikes <-> chrome.storage.sync (chunked, last-write-wins)
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
- **Storage:** big state in `storage.local` (written twice per run); likes/dislikes in `storage.sync`, chunked to stay inside the quota.
- **Privacy:** see [PRIVACY.md](PRIVACY.md).
