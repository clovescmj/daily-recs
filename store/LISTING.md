# Chrome Web Store listing

Paste these into the developer dashboard. Not shipped inside the extension package.

## Store listing tab

**Name:** Daily Recs for Bandcamp

**Summary (max 132 characters):**
New music every day, built from your own taste. Never shows what you already own on Bandcamp.

**Category:** Entertainment (or the closest music option available)

**Language:** English

**Description:**

> Daily Recs adds a "daily recs" tab to your own Bandcamp profile with a new list of up to 50 songs every day, and more load in the background while you listen. It starts from the albums you own and have in your wishlist, follows what other fans of those albums also own, and shows only albums you don't have, from artists you don't have, that share a genre with your taste, with no repeats.
>
> • Best matches: the albums that the most fans of your albums also own.
> • My tags: albums with the genres you pick.
> • Surprise me: albums from deeper in the same ranking, further from what you own. It never repeats Best matches.
> • The heart adds the song to your Bandcamp wishlist. The + adds it to Liked Songs, a list that stays in your browser and can be exported to a CSV file. The ⊘ hides an album, its artist and the albums Bandcamp pairs with it.
> • A player in Bandcamp's style, with a queue, Liked Songs and media keys. Each card is one song: the player plays it and then the next card, and more albums load in the background as you listen. While your first list loads, you can play a random song from your own collection.
> • The albums you hide sync between your computers through your Google account. Liked Songs stay in your browser, and the wishlist stays in your Bandcamp account.
>
> It runs in your browser and only talks to Bandcamp (bandcamp.com and the servers of its audio and covers). It uses the session you already have open and never sees your password. There are no analytics, no ads and no accounts. The About page (right-click the toolbar icon) has a button that clears everything it saved.
>
> You need to be signed in to Bandcamp. This is an independent project, not made, endorsed or supported by Bandcamp.

**Support URL:** https://github.com/clovescmj/daily-recs/issues  (or leave the store's own Support tab on)
**Homepage URL:** https://github.com/clovescmj/daily-recs

## Graphics (you need to make these with the extension running)
- Icon 128×128: already in the package (`icons/icon-128.png`).
- Screenshots, 1280×800 (at least 1, up to 5). Done: `store/images/screenshot-1-1280x800.png` (the tab with the album grid and the player bar). Ideas for more:
  1. The "daily recs" tab on your profile with the album grid.
  2. A card with hover on the title/artist and the heart and "don't show music like this" icons.
  3. The player bar playing an album, with the queue open.
  4. "Surprise me" loading (progress) or its list, with the "Best matches" button.
  5. The About page.
- Small promo tile 440×280 (required) and marquee 1400×560: already in `store/images/`.

## Privacy practices tab

**Single purpose:**
Show a daily list of new album recommendations on the user's own Bandcamp profile, based on their collection and wishlist.

**Permission justifications**
- `storage`: keeps the library snapshot, the recommendations and the user's taste on this computer, and syncs the albums the user hides (with a score per source of recommendations) through the user's Google account.
- `alarms`: about every 30 minutes, reads a handful of the pages of the user's own albums in the background, only to learn their genre tags (it pauses when Bandcamp asks to slow down), and schedules a retry after such a request.
- `offscreen`: opens a hidden page that only checks whether the browser is in dark or light mode, so the toolbar icon can use the symbol that is visible on the user's toolbar (the service worker cannot check this itself). It reads and sends no other data.
- `contextMenus`: adds the right-click menu on the toolbar icon (Open Daily Recs, Feedback, Report a bug, About).
- `scripting`: when the user clicks the heart, runs Bandcamp's own "add to wishlist" function in the user's Bandcamp tab, so the wishlist changes exactly as if they had clicked Bandcamp's button.
- Host access `https://*.bandcamp.com/*`: reads the user's collection and wishlist, and the "you may also like" section, tags and songs of album pages (these live on artists' subdomains). Nothing else is accessed. The audio and covers it plays come from Bandcamp's own media servers (`bcbits.com`), loaded by the page as any image or audio; no access is needed for that.
- Content script on `https://bandcamp.com/*`: adds the "daily recs" tab and the player bar to the user's own profile page. It is not loaded on the sign-in, account settings, cart and checkout, or purchases pages.

**Remote code:** No, I am not using remote code.

**Data usage (check what applies, and be accurate)**
- The extension reads website content (the user's Bandcamp library and album pages) and stores the albums the user hides and wishlists from the extension, the user's Liked Songs, what played today and a short record of what the user hid, wishlisted or liked. All of it stays on the device or in the user's own Chrome sync; none is sent to the developer or to any third party.
- Certify: the data is not sold to third parties, not used for purposes unrelated to the single purpose, and not used for creditworthiness or lending.

**Privacy policy URL:** https://github.com/clovescmj/daily-recs/blob/main/PRIVACY.md

## Before submitting
- [x] The code is on GitHub (so the privacy policy URL exists).
- [x] Screenshot 1 and the promo tiles are in `store/images/`; add more screenshots if you want.
- [ ] Upload `dist/daily-recs-<version>.zip` (run `npm run package`; the version is the one in `manifest.json`).
- [ ] Choose visibility: Public, or Unlisted (only people with the link).
- [ ] Re-read the Bandcamp terms about automated access.
