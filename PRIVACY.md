# Privacy policy: Daily Recs for Bandcamp

Last updated: October 2026

Daily Recs for Bandcamp is an independent extension. It is not made, endorsed or supported by Bandcamp.

## What it does with your data
- It uses the Bandcamp session you are already signed in with to read **your collection and wishlist** and the "you may also like" section and genre tags of album pages on `bandcamp.com`. It never sees or stores your password.
- It stores, **on your computer** (`chrome.storage.local`): a snapshot of your library (titles, artists and links), the recommendations it found, and a profile of the genre tags of your albums.
- It stores your **Liked Songs** (the songs you save with the + button: the song and album titles and the album link) on your computer too, in `chrome.storage.local`. They are never synced or sent anywhere.
- It keeps, **on your computer** (`chrome.storage.local`), what played today (the songs, their names and the position of the song that was playing), so the player can show it again after a reload. It only counts for the day it was kept, and it is replaced by the next day's.
- It stores your **taste** in `chrome.storage.sync`, which Chrome syncs through your own Google account, so it follows you to your other computers: the albums you add to your wishlist with the heart, the albums you hide, and a score for each source of recommendations. This is controlled by your Chrome sync settings. Liked Songs are not part of it.
- To play music it loads the audio and the cover images straight from Bandcamp's own servers (`bandcamp.com` and `bcbits.com`, the network Bandcamp uses for its media), the same way Bandcamp's own pages do. The "song while waiting" is a random song of your own collection, read from the page of one of your albums, and only starts when you press play.
- While the browser is open, it reads a few pages of your own albums in the background (a handful about every half hour) only to learn their genre tags, using your Bandcamp session like any visit. It pauses by itself when Bandcamp asks to slow down.
- It adds or removes an album from your Bandcamp wishlist **only when you click** the heart. Hiding an album never changes your Bandcamp account.

## What it does not do
- It does not send your data to the developer or to any server other than Bandcamp's (`bandcamp.com` and its media servers).
- It does not use analytics, advertising or trackers.
- It does not sell or share data with anyone.
- It does not load or run remote code.
- It does not run on Bandcamp's sign-in, account settings, cart and checkout, or purchases pages, nor on artist subdomains (`artist.bandcamp.com`), where it only fetches album pages in the background.

## Links
The "Feedback" and "Report a bug" links open the Chrome Web Store and GitHub in a new tab, only when you click them. The bug report link pre-fills the extension version and your browser's name, which you can edit or delete before sending.

## Contact
Open an issue at https://github.com/clovescmj/daily-recs/issues
