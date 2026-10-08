# Changelog

Versions follow the improvements, one step at a time (`MAJOR.MINOR.PATCH`): a new capability raises the minor number, a fix or
a small adjustment raises the patch number.

## 0.6.0
- The player bar has a thumbs-up button that opens the list of albums you like (the most recent like first, not only today's). Each item
  can be played, taken out of the likes (the green thumb) or added to / removed from the wishlist (the heart). It shares the space of the
  queue: opening one closes the other.
- The icons of the bar are grouped by thin separators: shuffle and next album, queue and likes, volume.

## 0.5.3
- Fix: the pause icon in the queue showed a single thick bar; it shows two bars again.
- Each item of the queue has the heart, the thumbs up and the thumbs down, and they act on that album (the heart and the thumbs up keep their colour).

## 0.5.2
- New wording for the thumbs: "See more like this" / "Stop seeing more like this" and "Hide this album" / "Show this album again".

## 0.5.1
- Hiding the album that is playing no longer waits for its replacement: the next album (or the next shuffled track) starts right away. The
  replacement is added at the end of the list in the background and, in shuffle, joins the albums that are left to play. Only when the
  hidden album was the last one does the replacement play, as soon as it arrives.

## 0.5.0
- The wishlist is kept apart from the like. On each card, the **heart** (left) only adds the album to, or removes it from, the Bandcamp
  wishlist. The **thumbs up** and **thumbs down** (right) only teach the taste: thumbs up turns green, thumbs down turns red and hides the
  album (a new one takes its place at the end, as before). The player bar has the same three buttons. "Go to album" is gone: the cover and
  the title already open it.
- A thumbs down never touches the wishlist any more (before, hiding a hearted album also removed it from the wishlist). Liking a hidden
  album brings it back; hiding a liked album takes the like back.
- Albums in the wishlist are remembered on this computer, never come back in a list, and count a little for the taste (less than a like).
- Albums that had a heart before this version keep it as a like and as a wishlist entry.

## 0.4.15
- A genre list aims for a full 50. When the user's own albums of the genre are used up and the list is still short, it goes on to the
  albums of that genre that Bandcamp recommended (one step beyond the user's albums, never further): their "you may also like" is read,
  and only albums that carry the genre are added. These come after the ones that come straight from the user's albums, up to three
  extra batches of reads per list. Their tags are not added to the user's taste profile. The same fallback serves a replacement album.

## 0.4.14
- The progress bar has a light grey track and Bandcamp's blue bar, so the progress is easy to see (it used to be dark grey on a dark track).

## 0.4.13
- In the genre picker, a genre that was typed but isn't in the list yet is offered as "+ Add “ebm”" (a button, not a check box); adding it
  puts it in the list already ticked. Enter adds it too.

## 0.4.12
- Fix: a replacement for a genre list no longer runs dry when every known album of that genre was used: more of the user's albums are
  scanned to find albums of the genre (found by repeating the test many times, where it sometimes found none).

## 0.4.11
- Fix: the album that takes the place of a hidden one in a genre list is now really of that genre. Albums whose tags were never read are
  no longer taken on trust: the tags of more of the leftovers are read and checked first, and if none fits there is no replacement.

## 0.4.10
- The favicon of the extension pages (About) is the same symbol as the toolbar icon, drawn in dark or white to match the theme (an SVG that
  follows the colour scheme), with the toolbar PNG as a fallback.

## 0.4.9
- About: explains choosing what to hear each day and the "My tags" option.

## 0.4.8
- New favicon (the small icon of the extension pages): the symbol from `design/favicon.png`, with its own margins, at 16 and 32 px.

## 0.4.7
- The About page starts with the logo (symbol, "Daily Recs", "For Bandcamp"), aligned to the left, in place of the banner of 0.4.6.

## 0.4.6
- The banner image at the top of the About page, shown through a shorter window (the same image, no new file for it).

## 0.4.5
- The number of new albums on the tab ("daily recs 35 new"), on the toolbar icon and in its menu now follows the list the user is
  using today (a genre list, Surprise me or Best matches), not only the Best matches list, and it changes when they pick another.

## 0.4.4
- The toggle shows the option the user just chose (for example "My tags: ebm") as soon as the list starts loading, instead of
  keeping the previous option highlighted until the list is ready. Same on the opening screen and on the list.

## 0.4.3
- Opening the genre drop-down on the opening screen no longer pushes Bandcamp's footer down: that screen is always tall enough for
  the menu, which is also a little shorter.

## 0.4.2
- The genre drop-down opens aligned to the left edge of its button, and to the right edge only when it would run past the window
  (on the opening screen and on the list).

## 0.4.1
- On the opening screen, "My tags" opens a drop-down with the genres, exactly like the one on the list (it used to open an inline
  box). The button shows the ticked genres, and the menu closes with a click outside or Esc.

## 0.4.0
- **Nothing is loaded until the user asks.** Opening the tab no longer builds a list in the background, and the extension no longer
  builds one by itself every few hours or when the browser starts: the opening screen shows, and the list of the chosen option is
  built when "Start digging" is pressed. The choice is remembered for the day: reopening the tab brings back the same list.
- The one-line "getting the list ready" note of 0.3.8 is gone (nothing loads on the opening screen any more).

## 0.3.8
- The opening screen says, in one quiet line under "Start digging", that today's list is being prepared in the background (and
  that the very first time takes a few minutes). Building the list starts the moment the tab opens.

## 0.3.7
- The selected button of the toggle keeps its dark look on hover (the text used to turn white on a light background).

## 0.3.6
- The opening screen no longer shows the progress bar of the list that is being built in the background; it appears once the
  user picks something (errors, like being signed out, are still shown).

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
