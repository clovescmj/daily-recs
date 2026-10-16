# Daily Recs for Bandcamp

New music every day, built from your own taste.

A Chrome extension that adds a **daily recs** tab to your Bandcamp profile: a fresh list of albums picked from what you own and what you've saved, never repeating and never showing what you already have.

## Install
From the [Chrome Web Store](https://chromewebstore.google.com/detail/fefclbgoafhlnelkmbhcjbafoimgnako), or by hand from a file. Step by step, for someone who is not a developer: [INSTALL.md](INSTALL.md). By hand, in short:

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose this folder (or the folder you extracted a [release](https://github.com/clovescmj/daily-recs/releases/latest) zip into).
3. Sign in to bandcamp.com as usual (the extension uses your existing session and never sees your password).
4. Open your profile: a **daily recs** tab appears next to collection / wishlist / followers. The toolbar icon takes you there (and asks you to sign in first if needed).

## How it works
- Starts from what you own and what you've saved on Bandcamp, and follows what the fans of those albums also own.
- Shows only what's new to you: nothing you own, nothing repeated. An album only gets in if it shares a genre with your taste, no genre takes more than about a fifth of a list, and albums of the same genre are not played one after the other. A list can be shorter than 50 when few albums fit.
- The **heart** adds an album to your Bandcamp wishlist, the **+** saves songs to Liked Songs (kept in your browser, exportable to a CSV file), and the **⊘** hides an album at once: that album, its artist and the albums Bandcamp pairs with it stop coming.
- **My tags:** albums with the genres you choose.
- **Best matches:** the albums that the most fans of your albums also own.
- **Surprise me:** albums from deeper in the same ranking, further from what you own. It never repeats Best matches.
- A player bar in Bandcamp's style (queue, Liked Songs, media keys). **Shuffle** works like a radio: one song from each album, and an album does not come back the same day. 50 more albums are asked for in the background when a list loads and again when 10 or fewer are left (up to 300 a day). While your first list is built, a random song from your collection can play.
- A tab left open past midnight shows a banner to get the new day's list; a small dot on the toolbar icon says that a version with news was installed.

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
    ranking.js           scoring, which albums get in (genre fit, a limit per genre, genres spread out), surprise mode
    recommender.js       refresh / feedback use cases (store + fetch injected)
    taste-sync.js        hidden albums + source scores <-> chrome.storage.sync (chunked, last-write-wins)
    taste-profile.js     genres of the user's albums and which ones are offered (genres.js: known genres, places.js: places that are never genres)
    play-plan.js         what plays next in Shuffle (one song per album, no album twice a day)
    queue-rows.js        which rows the queue shows (Full album and Shuffle)
    liked.js, liked-csv.js   the Liked Songs list, and its CSV export
    decisions.js         the local record of what was hidden, wishlisted or liked (to tune the lists)
    pending.js, versions.js  a list that was asked for; major updates (the dot on the icon)
    state.js, messages.js, storage-keys.js, config.js
  background/            service worker (registers every listener synchronously at top level)
    service-worker.js    entry point
    jobs.js, messages.js, storage.js, navigation.js, menu.js, wishlist-in-page.js
  content/               tab injected into the user's own Bandcamp profile
  player/                Bandcamp-style player bar (classic script + CSS)
  styles/                design tokens (tokens.css) and shared components (components.css), used by the page, the player bar and the tab
  pages/
    recs/                the recommendations page (ES modules, one concern per file; main.js wires them)
    about/               About page and the "What's new" page (one short note per release: keep it up to date when you ship)
    shared/
  assets/                the logo of the About page (the player icons are inline SVG)
test/                    node:test suites with an offline fake Bandcamp
INSTALL.md               how to install from a release zip, for someone who is not a developer
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
- **Storage:** big state in `storage.local` (written twice per run); the Liked Songs under their own key, `likedSongs`, written by the page at once and never by a run (see `src/lib/liked.js`); the record of decisions under `decisions` (up to 1000 entries); hidden albums and source scores in `storage.sync`, chunked to stay inside the quota.
- **The radio:** Shuffle asks the service worker for 50 more albums at a time (`extend-list` with a count), which reads more of the leftovers' genres and applies the same rules as the list. See `maintainRadio` in `src/pages/recs/player.js`.
- **Privacy:** see [PRIVACY.md](PRIVACY.md).
