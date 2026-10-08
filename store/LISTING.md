# Chrome Web Store listing (draft)

Paste these into the developer dashboard. Not shipped inside the extension package.

## Store listing tab

**Name:** Daily Recs for Bandcamp

**Summary (max 132 characters):**
New Bandcamp albums every day, picked from your own collection. Never shows what you already own.

**Category:** Entertainment (or the closest music option available)

**Language:** English

**Description:**

> Find new music every day, without losing the evening.
>
> Daily Recs starts from what you own and what you've saved on Bandcamp, finds albums that fans of those records love, and keeps the ones that fit your taste. Every list is made of albums you don't own, from artists you don't have, and nothing repeats.
>
> • A fresh list of 50 albums every day, right inside your Bandcamp profile, in a new "daily recs" tab
> • The heart adds an album to your Bandcamp wishlist
> • "Don't show music like this": that album, its artist and what Bandcamp pairs with it stop coming
> • Hide what you don't: it never comes back
> • Three lists: "My tags" (the genres you pick), "Best matches" and "Surprise me" (music that goes beyond your collection)
> • A built-in player in Bandcamp's own style, with a playback choice (one song per album, or whole albums), queue and media keys
> • The albums you hide sync across your computers through your Google account
>
> Private by design: everything runs in your browser and only talks to bandcamp.com. No analytics, no ads, no accounts.
>
> You need to be signed in to Bandcamp. This is an independent project. It is not made, endorsed or supported by Bandcamp.

**Support URL:** https://github.com/clovescmj/daily-recs/issues  (or leave the store's own Support tab on)
**Homepage URL:** https://github.com/clovescmj/daily-recs

## Graphics (you need to make these with the extension running)
- Icon 128×128: already in the package (`icons/icon-128.png`).
- Screenshots, 1280×800 (at least 1, up to 5):
  1. The "daily recs" tab on your profile with the album grid.
  2. A card with hover on the title/artist and the heart and "don't show music like this" icons.
  3. The player bar playing an album, with the queue open.
  4. "Surprise me" loading (progress) or its list, with the "Best matches" button.
  5. The About page.
- Small promo tile 440×280 (required): the grid of covers with the name "Daily Recs".

## Privacy practices tab

**Single purpose:**
Show a daily list of new album recommendations on the user's own Bandcamp profile, based on their collection and wishlist.

**Permission justifications**
- `storage`: keeps the library snapshot, the recommendations and the user's taste on this computer, and syncs hidden albums through the user's Google account.
- `alarms`: checks once every few hours whether a new day has started, to prepare the day's list in the background, and schedules a retry when Bandcamp asks to slow down.
- `offscreen`: opens a hidden page that only checks whether the browser is in dark or light mode, so the toolbar icon can use the symbol that is visible on the user's toolbar (the service worker cannot check this itself). It reads and sends no other data.
- `contextMenus`: adds the right-click menu on the toolbar icon (Open Daily Recs, Feedback, Report a bug, About).
- `scripting`: when the user clicks the heart, runs Bandcamp's own "add to wishlist" function in the user's Bandcamp tab, so the wishlist changes exactly as if they had clicked Bandcamp's button.
- Host access `https://*.bandcamp.com/*`: reads the user's collection and wishlist, and the "you may also like" section and tags of album pages (these live on artists' subdomains). Nothing else is accessed.
- Content script on `https://bandcamp.com/*`: adds the "daily recs" tab and the player bar to the user's own profile page.

**Remote code:** No, I am not using remote code.

**Data usage (check what applies, and be accurate)**
- The extension reads website content (the user's Bandcamp library and album pages) and stores the albums the user hides. All of it stays on the device or in the user's own Chrome sync; none is sent to the developer or to any third party.
- Certify: the data is not sold to third parties, not used for purposes unrelated to the single purpose, and not used for creditworthiness or lending.

**Privacy policy URL:** https://github.com/clovescmj/daily-recs/blob/main/PRIVACY.md
(This only works once the code is pushed to the repository.)

## Before submitting
- [ ] Push the code to GitHub (so the privacy policy URL exists).
- [ ] Take the screenshots and the promo tile.
- [ ] Upload `bandcamp-daily-recs.zip` (run `npm run package`).
- [ ] Choose visibility: Public, or Unlisted (only people with the link).
- [ ] Re-read the Bandcamp terms about automated access.
