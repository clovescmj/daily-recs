# How to install Daily Recs for Bandcamp

The extension is waiting for the Chrome Web Store review, so for now it is installed by hand. It takes about two minutes.

**You need:** Google Chrome (or another Chromium browser, such as Edge or Brave) and a Bandcamp account, preferably with some albums in your collection or wishlist.

## 1. Download the extension
Open the [latest release](https://github.com/clovescmj/daily-recs/releases/latest) and download the file `daily-recs-<version>.zip` listed under **Assets**.

## 2. Extract it into a folder
Create a folder for it (for example `daily-recs`) somewhere it can stay, such as your Documents, and extract the zip inside it. You should see `manifest.json`, `icons` and `src` inside the folder.

Do not delete or move the folder afterwards: Chrome reads the extension from it.

## 3. Install it in Chrome
1. Open `chrome://extensions` (paste it in the address bar).
2. Turn on **Developer mode**, at the top right.
3. Click **Load unpacked**.
4. Choose the folder from the previous step (the one with `manifest.json` inside).

If the extension shows up in the list without errors, it is installed.

## 4. Use it
1. Sign in to [bandcamp.com](https://bandcamp.com).
2. Open **your profile**: click your avatar, then *Profile*.
3. A new **daily recs** tab appears next to *collection* and *wishlist*. Click it.
4. Choose what to hear: **My tags**, **Best matches** or **Surprise me**, then click **Start digging**.

The first list takes a few minutes, because the extension reads your collection. While you wait, you can play a song from your collection with the button in the loading box.

## Tips
- The **heart** adds an album to your Bandcamp wishlist.
- The **+** saves songs to **Liked Songs**, which lives only on your computer.
- The **⊘** hides an album and music like it.
- Everything runs in your browser and only talks to Bandcamp. There is no account and no tracking (see [PRIVACY.md](PRIVACY.md)).

## Updating
Download the new zip from the [releases page](https://github.com/clovescmj/daily-recs/releases), extract it over the same folder, then open `chrome://extensions` and click the reload button on the extension's card.

## Common problems
- **I don't see the "daily recs" tab:** make sure you are signed in and on your own profile, then reload the page (F5).
- **Chrome warns about developer mode extensions when it starts:** this is normal for extensions installed this way. Choose to keep them.
- **Something else:** [open an issue](https://github.com/clovescmj/daily-recs/issues).
