# Changelog

Versions follow the improvements, one step at a time (`MAJOR.MINOR.PATCH`): a new capability raises the minor number, a fix or
a small adjustment raises the patch number.

## 0.3.5
- Tidy-up: the repository keeps only the files it needs (design sources, the icons the manifest uses, the three store images);
  unused icon sizes are no longer in the package.

## 0.3.4
- New icon (the parallelogram with a sparkle cut out of it): toolbar icon in black and in white (white is the default and the one
  used on dark toolbars), icon for the extensions page and the store (black on white, artwork at 75% as Chrome recommends),
  promo tile and banner. The sources are in `design/`; the store images are in `store/images/`.

## 0.3.3
- The genre picker no longer offers things that aren't genres: formats and years (cassette, 2023…), generic words, names of
  labels and artists (tags that are part of the account name that released the albums), tags that are almost never among the
  first ones on a page, and tags found on a single album. They stay in the taste profile.

## 0.3.2
- Opening screen, shown the first time the tab is opened each day: "What do you want to hear today?" with My tags, Best matches
  and Surprise me, and a "Start digging" button. The next times of the day the tab opens straight on the list.

## 0.3.1
- Hiding an album brings a new one to the end of the list (from what the run left over, or reading a few more albums in the
  background). The new album plays next; in shuffle, one of its tracks does.

## 0.3.0
- **Lists by genre.** A "My tags" picker with the genres found in the user's albums (check boxes, and a field to type one). The
  list starts from the user's own albums of those genres and keeps only albums of the genre. Several lists per day, switched
  with a toggle (My tags, Best matches, Surprise me); the same album may appear in different lists of the same day.
- Background scan: a few of the user's albums are read every 30 minutes to learn their genre tags, one album at a time.
- Genre tags are stored per album; different spellings of a genre (ebm, e.b.m, electronic body music) count as one.
- The page uses Bandcamp's own design tokens (colours, type scale, radius, focus).

## 0.2.6
- Albums on a label's own domain (e.g. listen.20buckspin.com) play through Bandcamp's embedded player instead of failing with a
  cross-origin error, and pages the extension cannot read are skipped when picking and scanning.

## 0.2.5
- New tagline, wording of the About page, footer order.

## 0.2.4
- Each genre is kept in proportion to the user's taste in a list (a small genre can no longer fill a quarter of it); spellings
  of the same genre are merged.

## 0.2.3
- The play button next to the title shows two pause bars; spacing of the card actions; "go to album" on the right.

## 0.2.2
- Albums start on the track the artist highlights. Shuffle plays every track of every album before repeating.

## 0.2.1
- New icons that follow the browser theme; simpler README; sources of the symbol for Figma.

## 0.2.0
- First version sent to the Chrome Web Store: daily list of 50 albums, genre-aware ranking, Surprise me, player, About, support links.
