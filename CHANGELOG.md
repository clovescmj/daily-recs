# Changelog

Versions follow the improvements, one step at a time (`MAJOR.MINOR.PATCH`): a new capability raises the minor number, a fix or
a small adjustment raises the patch number.

## 1.1.18
- The tooltips of the Play mode buttons have two lines: "Play mode", then the text of the mode ("Full album: albums in order, every song" or "Shuffle: one song from each album, in random order").

## 1.1.17
- Opening the queue scrolls it to the album that is playing: its "Playing now" heading goes to the top of the list. With nothing playing, the list starts at the top.

## 1.1.16
- Play mode: the icon of the selected button is white again (the bar's `a { color: inherit }` rule was beating the component's colour, so it showed grey on the dark
  button), and the two buttons touch each other (the space between them showed, because the bar made the control `inline-block`).
- The Full album icon has a disc (a circle with a small dot) cut out of the card, in place of the play triangle.
- The tooltips of both buttons start with "Play mode".

## 1.1.15
- The close icon (the X of the queue and Liked Songs) and the mute icon are the 18 px variants of Material Symbols (`close`, `volume_off`), like the other icons.

## 1.1.14
- The icons are the 18 px variants of Material Symbols (optical size 20), downloaded from the site and converted to the 24 grid of the code: the heart (outline and filled), the +,
  the check circle, the block icon, the queue (`playlist_play`), Liked Songs (`library_music`, filled), volume, shuffle, Full album (Material's `full_album`, in place of the
  disc of 1.1.11), the three list buttons, the arrow of the genre button, and play and pause. Every icon is now **18 px** (one token, `--dr-icon-size`), the big play and pause
  (28 px) and the arrows apart. Still as before: the previous and next arrows, the close icon, the mute icon and the spinner (no new file).

## 1.1.13
- The icon of Best matches is the 18 px variant of Material's `target_check` (optical size 20, downloaded from Material Symbols), which keeps its lines firm at this size.

## 1.1.12
- Icons inside buttons are 18 px (they were 16 px, which rendered a little rough): the list buttons, Play mode, the song while waiting and the arrow of the genre button.
  Icons on their own stay at 20 px. Token `--dr-icon-size-button`.

## 1.1.11
- Two sizes for the icons: **16 px** (made 18 px in 1.1.12) for an icon inside a button (the list buttons, Play mode, the song while waiting, and the arrow of the genre button) and **20 px** for an
  icon on its own (the heart, the + and the block icon, the queue, Liked Songs, volume and the close icon). The big play and pause and the previous and next arrows
  keep their own sizes. New tokens `--dr-icon-size` (20 px) and `--dr-icon-size-button` (16 px).
- The arrow of the genre button is Material's `arrow_drop_down` (a small solid triangle) instead of a thin chevron.
- The Full album icon has the shape of the Liked Songs icon, with a disc in place of the music note.

## 1.1.10
- The icons are back to the sizes of 1.1.8: the heart, the + and the block icon are 18 px again (1.1.9 had made them 20 px). The rest is as it was.

## 1.1.9
- One size for the icons: every icon is now in a 20 px box (token `--dr-icon-size`, which was 18 px): the heart, the + and the block icon of the cards, the queue and the
  player bar, besides the list buttons, the queue, Liked Songs, volume and play mode icons that already were. The big play and pause (28 px), the previous and next arrows,
  and the small arrow of the genre button keep their own sizes.

## 1.1.8
- New filled icons (Material Symbols, made solid from the outline files): the list buttons (My tags, Best matches, Surprise me) in a 20 px box, the same as the icons of the
  player; the play and pause of the page header and of the player bar (a 28 px box, since the glyph takes about half of it); and the volume icon. The heart, the + and the
  block icon stay as they were.

## 1.1.7
- The button of the loading box is as wide as its text again, up to 260 px (before, 1.1.6, it had one fixed width). A name longer than that scrolls inside it.

## 1.1.6
- The button of the loading box (a song from your collection while the list is built) is a square-cornered button like Bandcamp's, always the same width (250 px, it shrinks
  in a narrow window). It reads "Play a song while waiting" and shows Material's plain play and pause icons. While a song plays it shows "Artist - Song" (no "Now playing"),
  with the same fade between the two texts; a name wider than the button scrolls inside it, to the end and back (not with reduced motion: it is cut with an ellipsis).

## 1.1.5
- The full stop at the end of sentences stays only in the two lines at the top of the genre menu. The "first time only" note, the toasts (wishlist and Liked Songs) and
  the note in the footer of Liked Songs are back to how they were, without it.

## 1.1.4
- The genre menu is wider (340 px instead of 300 px), so its first line no longer breaks in two.
- Texts that are sentences now end with a full stop: the genre menu lines, the "first time only" note while learning your taste, the toasts (wishlist and Liked Songs)
  and the note in the footer of Liked Songs. Tooltips, titles and short labels stay as they were.

## 1.1.3
- Play mode icons: Shuffle is now Material's own icon (it looked too big), and Full album is a disc inside Material's empty square. Both use the same 960 box as the other Material icons.

## 1.1.2
- Play mode: the two icons (Full album, Shuffle) now have the same size as the other icons on the right of the bar (a 20 px box, a glyph of about 15 px, like the queue icon).

## 1.1.1
- Play mode has two options now, shown as a pair of buttons with icons (a tooltip says what each does) instead of a menu: **Full album** (the default: the albums
  in order, every song, starting at the first song of the first album) and **Shuffle** (one song of each album in a random order, never the same song twice, with new
  rounds until everything has played). "One song per album" is gone; if it was your saved choice, you get Full album. Shuffle still starts each album with the song
  its artist highlights.

## 1.1.0
- "Playback" is now **Play mode**, with a third option, **Shuffle**. In "One song per album" and in "Shuffle" a song plays only once. The first time an album plays,
  it plays the song its artist highlights; later rounds draw one of the songs that have not played. "One song per album" keeps the order of the list and starts over
  at the end; "Shuffle" plays the albums in a random order, with a new order for each round. An album with no song left is skipped, and the player stops when every
  song has played; Play then starts everything again. The queue follows the mode (in Shuffle it shows the order of the round), and the previous button goes back along
  the songs that played. "Full album" is unchanged.

## 1.0.9
- When the list is ready while a song of your collection is playing, the song is no longer stopped: it keeps playing and now shows in the player bar (without the
  wishlist, Liked Songs and hide icons, since it is on no list). Next, or the end of the song, moves on to the first album of the list. (This replaces the fade out
  of 1.5 s that started the list.)

## 1.0.8
- Fix: the + of a card did nothing and never lit up (1.0.6 left a call to a removed helper in the cards' repaint, which stopped the save before it was written).
  It now adds the whole album to Liked Songs, lights up, and takes it out on a second click, also when nothing is playing.

## 1.0.7
- The Recommendations queue and Liked Songs lists now share one layout: the same header (title, count, close), rows with the cover, the title and a second line
  (artist, or artist and album for a song), the same icons and hover, and a footer. The queue groups its rows under "Played", "Playing now" and "Up next" (the playing
  album shows equaliser bars on its cover) and its footer counts the albums played; the footer of Liked Songs says where the list is stored. The don't-show icon
  appears on hover.

## 1.0.6
- A card only shows its album as added to Liked Songs when the whole album was added with the + of the card. Saving a single song from the player no longer ticks the
  album. Each song added with its album carries a mark (`all`) that is cleared as soon as you take one of its songs out. Albums added before this version show as not added
  until you add them again.

## 1.0.5
- Player bar: the play button, the title with its progress bar, and the previous / next arrows are now centred on the cover (the play button was 3 px high, and the
  progress block 1 px low). The buttons on the right (Playback, queue, Liked Songs, volume) sit on the same centre; the arrows stay on the line of the progress bar.

## 1.0.4
- Your Liked Songs are safer. They now live under a storage key of their own (`likedSongs`), apart from the big state, and they only change when you add or take out a
  song: a search, an update of the extension or a state that has to be rebuilt can no longer touch them. They are also written the moment you click the +, straight from
  the page, instead of waiting in the queue of the service worker behind a search (or being lost if the browser stops the worker). A search that ends with an old copy of the
  state no longer undoes what you liked meanwhile. The first time, the list you already had moves to the new key by itself. They still stay on this browser only (an
  export / import is planned).

## 1.0.3
- A bolder animation when a song goes to Liked Songs: the cover of its album appears above the Liked Songs icon, shrinks into it, and the icon jumps and wobbles as if it kept
  the cover. Songs added one after the other (an album adds all its songs) play one animation, not many. With "reduce motion" on, there is no animation.

## 1.0.2
- Wording review: one name per thing. "Liked Songs" everywhere (the button, the panel and its close button), the button of the queue is "Recommendations queue", the tags menu says
  "tags" (Type a tag…, Tags found so far, Find music (2 tags)), loading step "Checking tags", wishlist messages are "Added to your wishlist" / "Removed from your wishlist"
  (one reload hint instead of two), and the error texts match the screens ("You're not signed in to Bandcamp.", "Bandcamp asked us to slow down.").
- The summary of the extension (manifest and store) says the same as the page: "New music every day, built from your own taste. Never shows what you already own on Bandcamp."
  The store description names the three lists with the same words as the app, and the old "Hide what you don't" bullet is gone.
- The old progress texts that were kept only for a test are removed.

## 1.0.1
- A "What's new" page, opened from the About page, with a short note per release (`src/pages/about/whats-new.html`). The full history is this file, which now also
  travels inside the zip. Docs and store texts are all in English.

## 1.0.0
First stable version. What it does:
- A **daily recs** tab on your own Bandcamp profile with a fresh list of albums every day, picked from what you own and save, never repeating and never showing what you
  already have. Three lists: **My tags** (explore new music by genre), **Best matches** (perfect matches with your collection) and **Surprise me** (go beyond your collection).
- **Heart** (Bandcamp wishlist, the only thing that touches your account), **+** (Liked Songs, kept in your browser) and **⊘** (don't show music like this).
- A player bar in Bandcamp's style: one song per album or full albums, queue, Liked Songs, and a random song of your collection while a list is being built.
- One design system for the page, the bar and the tab (`src/styles`), with Bandcamp's own values, and our own drawings for every icon and animation.
- Private by design: everything runs in your browser and only talks to Bandcamp.

## 0.18.16
- From the opening screen to the loading: "Start digging" fades the opening screen out (0.3 s) and then fades the list in (its header, the progress and the placeholders, 0.3 s),
  instead of swapping at once. With "reduce motion" on, it still swaps at once.

## 0.18.15
- The icons that are used in the player bar are SVG now, not images: the previous and next arrows and the spinner of the song that is loading. The spinner is one
  drawing that turns in nine steps (like the nine pictures it replaces), so it is sharp at any zoom, uses the tokens, and stops when the system asks for less motion.
  The two image files are gone, and the page of the extension no longer has to be told which images to load from the Bandcamp page. The About logo stays a PNG.

## 0.18.14
- Our own drawings, looking the same: the previous / next sprite and the loading spinner of the player bar are redrawn from their shapes (measured to match: the
  difference is about 1 in 255 per pixel), and the check mark of the Liked Songs circle, the check of the Playback menu and the record-box icon of the full-album mode are
  now simple shapes of ours. Nothing is copied from Bandcamp's files any more (the layout and style of the bar still follow Bandcamp's).
- Docs: the privacy policy now mentions Liked Songs, the audio and covers that come from Bandcamp's media servers, and the song while waiting; the store listing and the README
  describe the current features; the store has its first screenshot (`store/images/screenshot-1-1280x800.png`).

## 0.18.13
- Wording: "Click" instead of "Tap" in the empty Liked Songs and in the About page (it is a desktop extension).

## 0.18.12
- A tag that holds several genres is now split into those genres, for all the usual ways of writing a list: `#hashtags`, commas, semicolons and slashes ("rock, punk",
  "hip-hop/rap", "punk #ebm #lofi"). It also fixes what was already stored: the albums you had scanned, the genre labels, the taste profile (the weight of the list is shared
  among its genres) and the cache are cleaned the next time the extension loads, and places are removed from them. Nothing is read again.

## 0.18.11
- Cleaner genres in the picker. Junk like "punk #ebm #lofi #post-punk", "tbilisi", "khidi" or "othr" no longer shows up:
  - a tag where the artist wrote a list of #hashtags is read as the separate tags (punk, ebm, lofi, post-punk) instead of one odd tag;
  - names of countries, regions and cities (about 400) are never genres, and are not even recorded when an album is read;
  - a tag only counts as a genre when it is a known genre (a list of about 450) found on two of your albums; any other tag (a club, a scene, a typo, a label) has to be on
    four albums and almost always among the first tags of the page;
  - tags with odd characters are dropped.
  Your albums are not read again: the filter works on what was already scanned.

## 0.18.10
- The text of the primary buttons (Start digging, Find music) is centred vertically by its letters: it sat about 2 px low, because the box is centred by the line and the
  letters rest on the baseline. The boxes keep their size.

## 0.18.9
- Liked Songs has an empty state: the list icon, "No liked songs yet" and "Tap the + on an album or in the player to save songs here.", with the same + icon
  as the cards (the grey one, before it turns green). It also shows from the start; before, the empty panel was blank until a song was added and removed.

## 0.18.8
- Opening screen: the line under the options ("Perfect matches with your collection.") always has its line reserved, so it appearing no longer pushes the Start digging button down.
  Opening the genre menu no longer scrolls the page to its search field.

## 0.18.7
- About: "How it works" is shorter and says what you get (five lines); the separate "Listening" section is gone.

## 0.18.6
- About page updated: Liked Songs and the + button, the ⊘ inside genre lists, a short "Listening" section (playback modes, the queue, the song while the list loads), and the
  privacy line says that the audio comes from Bandcamp's own servers.

## 0.18.5
- The primary button when it can't be pressed is the light blue of the profile's disabled button (`#95cddf`, white text), not grey.

## 0.18.4
- The text of the primary button is bold, like the blue button of the profile.

## 0.18.3
- The primary button (Start digging, Find music) is the blue button of the Bandcamp profile (`#309fc3`, like "Send message"), with a darker hover and pressed look; disabled
  stays grey. Its colours are tokens of their own (`--dr-profile-button*`). The hover and pressed colours are my estimate of the profile's, not read from it.

## 0.18.2
- The accent blue is the blue of the profile's own tabs again (`#00a1c6`), now a token of its own (`--dr-profile-blue`), since the profile uses it and Bandcamp's design system
  does not have it. Links, checks and the progress of the loading use it, so they match the tab bar next to them.

## 0.18.1
- The token values are now Bandcamp's own, read from bandcamp.com (the names stay ours). Visible changes: the accent blue is Bandcamp's blue (`#0cacd7`), "don't show"
  is Bandcamp's red (`#e50a0a`), the heart in the wishlist is Bandcamp's orange (`#e65225`), resting icons are `#949494`, the primary button (Start digging, Find music)
  is Bandcamp's dark button with its hover, pressed and disabled looks, the hover of the selects is Bandcamp's 8% veil, the titles of the page and of the queue are 1.25 rem,
  and the lines of the bar, the progress and the veil over the covers use Bandcamp's transparencies.

## 0.18.0
- **Every value comes from the tokens.** Not only the corner radius: all colours, greys, font family, sizes and weights, line heights, durations and delays of the
  recs page, the player bar, the tab and the About page now use `src/styles/tokens.css`, which follows Bandcamp's design system (palette, type scale, 4 px corners).
  No loose colour, size or timing is left in the stylesheets.
- A few near-duplicates became one value: the base text of the player bar (`#505958`) is Bandcamp's grey `#5a5a5a`, the dark marks (`#2d2d2d`, `#333`) are `#333`, the
  bars of the player are `#333`, and the separator of the bar uses the same line as the bar.

## 0.17.6
- One corner radius, Bandcamp's (4 px, `--dr-radius`), everywhere: the queue and Liked Songs panels (their top corners were 5 px), the play button over the
  covers (3 px), and the toast and the "new" tag of the tab, which had the 4 px written by hand.

## 0.17.5
- The queue and Liked Songs panels have a border, in the same colour as the line of the player bar (it closes them at the bottom).

## 0.17.4
- The Liked Songs icon no longer restarts its jump halfway when several songs are added in a row (an album adds all its songs one after the other): one jump at
  a time, and a new one only after it has finished.

## 0.17.3
- Fixed: the genre menu had no fade and slide when it opened and closed. A general rule of the page (`[hidden]` means `display: none`) was stronger than the menu's
  own closed state, so the menu was removed instead of animated. Menus are now the exception to that rule.

## 0.17.2
- Fixed: opening the profile straight on the daily recs tab (the toolbar icon, or a reload on that tab) showed Bandcamp's own collection for a moment before our tab
  replaced it. The collection is now kept out of sight from the first moment (a small script that runs as the page starts loading), and shown again if the
  tab can't be opened (not your profile, or the page takes too long).

## 0.17.1
- Fixed: when the page opened, it first drew the Best matches list and, a moment later, replaced it with the list you had chosen today (or with the
  opening screen). Now the first drawing is already the right one: the page stays blank until it knows what to show, today's choice is applied before
  the first drawing, and a list that is still being built shows its placeholders instead of another list or a message.

## 0.17.0
- **Design system.** The colours, sizes and timings used by more than one element now live in one place, `src/styles/tokens.css` (`--dr-*`), used by the
  recs page and by the player bar. The page and the bar no longer repeat the same hex values.
- **Shared components** in `src/styles/components.css`: `dr-select` (the buttons that pick a list or open a menu), `dr-menu` with `dr-menu-head` and
  `dr-menu-row` (the genre menu and the Playback menu are now the same component), and `dr-act` (the heart, the + and the ⊘, which were drawn three times,
  on the cards, in the bar and in the queue).
- The queue icons have the same size and spacing as the ones of the cards and the bar (18 px, 12 px). Unused styles and variables were removed.
- The About page loads the same tokens.

## 0.16.9
- The Playback button and its menu now follow the genre button and its menu: same height (32 px), border, text and hover on the button; same rows
  (12 px text, same spacing and hover colour), header, colours, shadow, and the same fade and slide (0.15 s, 6 px) when they open and close.
  The queue rows use the same hover colour.
- One green for "in Liked Songs" (the cards and the player used two), one blue for the loading bar and the equalizer (the accent blue, like the links), and the
  placeholder shimmer uses the page greys.

## 0.16.8
- Fixed: 0.16.7 broke the recs page (a helper was removed by mistake and the page stopped at the start). Nothing else changed.

## 0.16.7
- The page no longer scrolls by itself when a list finishes loading: it stays where you left it. (The scroll to the top of the list was sent after the
  search ended, so it fired right when the albums appeared.)

## 0.16.6
- Clean-up, nothing changes on screen: unused styles removed (`.sr-only`, `.button--ghost`, and the toast of the page, which has been drawn by the
  Bandcamp page for a long time), duplicated style rules merged, an unused function removed, and a stale comment fixed.

## 0.16.5
- Player bar: the heart, + and ⊘ sit on the bottom edge of the cover (the title already starts at its top edge).

## 0.16.4
- The queue and Liked Songs panels are back to their old shape (no border, rounded top corners, against the bar), with the same shadow as the menus. They open
  rising a little from the bar (14 px) instead of fading.

## 0.16.3
- When the list is ready while a song of the loading is playing, the song fades out (1.5 s) and the first album of the list starts. If the song was
  paused, nothing starts by itself.

## 0.16.2
- The text of the loading button says where the song comes from: "Play a song from your collection while waiting".

## 0.16.1
- The player bar no longer shows up while a song plays during the loading: the button of the loading box is the only control (the bar appears when the list is ready, as always).

## 0.16.0
- **A song while you wait.** On the right of the loading box there is "Play a song while waiting" and a small play button (Material's play and
  pause circles). It plays a random song from an album of your own collection (not the wishlist or the recommendations). While it plays, the
  line says "Now playing: Artist - Song" and the button turns into pause; paused, the first text comes back. The text changes with the same
  fade as the title of the steps. When the song ends, another one starts, until the list is ready. The player bar shows the song meanwhile.
- Fixed: the player bar failed to draw when something played before any list existed (the queue was missing in the first update).

## 0.15.14
- The Playback menu, the queue, Liked Songs and the genre menu open and close with a short fade and slide (they used to pop in and out).

## 0.15.13
- The queue and Liked Songs panels sit against the bar again (they keep the new border, corners and shadow).

## 0.15.12
- The queue and Liked Songs panels have the same border, corners, shadow and distance from the bar as the Playback and genre menus.

## 0.15.11
- The Liked Songs icon now jumps and wobbles from side to side, like a bell, when a song is added (instead of the two bumps).

## 0.15.10
- The bump of the Liked Songs icon is bigger (10 px and 5 px, with a little zoom) and the icon turns the accent blue while it jumps.

## 0.15.9
- The dot after the heart in the player bar is gone: the heart, the + and the ⊘ are evenly spaced (12 px).

## 0.15.8
- The queue and Liked Songs panels close when you click outside them: anywhere on the Bandcamp page or inside the recs page.

## 0.15.7
- Next to the cover, the player bar shows the name of the song with the artist under it (it was the album's name), and the cover and the
  name link to the song's own page on Bandcamp instead of the album's.

## 0.15.6
- The Playback menu has the same border, corners, shadow and distance from its button as the genre menu.
- The Playback menu closes when you click anywhere in the recs page, not only on the Bandcamp page around it.

## 0.15.5
- Loading texts are shorter and consistent ("Signing in", "Reading your library", "Sampling your collection", "Ranking candidates", "Checking genres",
  "Choosing your 8"). The second line only shows when there is something to say (how many albums are done, how many candidates were found); it
  slides in and out, the title fades in at each step, and the text stays centred in a box that keeps its height. The counter on the right is gone.

## 0.15.4
- The Playback menu follows the genre menu: the title "Playback" in bold, a short explanation under it in normal text, and a thin line
  before the options. The chosen option has Bandcamp's own check, in the accent blue, instead of a bold name.

## 0.15.3
- Adding a song to Liked Songs makes the list icon in the player bar bump up twice, softly (not with "reduce motion" on).

## 0.15.2
- Loading: the placeholder cards fill whole rows of the grid (two rows, whatever the number of columns, and they follow the window if it
  is resized), they come in one after the other, and the shimmer is easier to see.
- Loading: the box keeps the same height all the time. It always has two lines (what is being done, and a short detail), so it no longer
  starts with one line, grows to two and then pushes the page down.

## 0.15.1
- Each item of the queue has the + for Liked Songs, between the heart and the ⊘: it adds the whole album (like on the cards), turns into
  the green check when a song of the album is in the list, and a second click takes the album out.

## 0.15.0
- **New loading.** While a list is being built, the grey box with one line is replaced by a box with an animated equalizer, what is being
  done ("Digging through your collection…"), a detail line ("Reading 60 of your 1,605 albums"), a counter (24 / 60) and a thin progress
  bar, and the grid shows placeholder cards that shimmer where the albums will be, so the page does not jump when they arrive. With "reduce
  motion" on, nothing moves.

## 0.14.15
- Under the "Find music" button of the genre menu there is now a caption (Bandcamp's small text size): "This will refresh your list with a new
  search." The page keeps a little more room (540 px) for the menu, which is now taller.

## 0.14.14
- The icons (heart, +, ⊘ and the buttons of the player bar and of its lists) no longer get a grey background when clicked. The focus ring
  for keyboard users is kept.

## 0.14.13
- Player bar: the "·" after the heart is closer to the icons on both sides (7 px instead of 12 px).

## 0.14.12
- The button that opens the Liked Songs list in the player bar uses the "library music" icon (a note on a stack of albums) instead of the
  bookmark.

## 0.14.11
- The + on a card says **"Add album to Liked Songs"** (and "Remove album from Liked Songs"), and it adds **all the songs** of the album
  (up to 60); taking it out removes them all. The + of the player bar says **"Add to Liked Songs"** and adds **only the song that is
  playing**. (A test that depended on the draw was made steadier.)

## 0.14.10
- The two icons of the Playback button (and of its list) are centred in their own box and have a similar size: the record box was
  bigger and heavier than the music note, so it is a little smaller and the note a little bigger.

## 0.14.9
- Once a song is in Liked Songs, the + becomes a **filled** green disc with Bandcamp's check mark cut out of it (cards, player bar and list),
  filled the way the heart is when it is selected.

## 0.14.8
- Genre picker: the "+ Add “…”" row for a typed genre now comes first in the list (it used to be at the end, out of sight in a long list),
  and Enter adds it. When there is no such row, Enter ticks the first genre of the list that is not ticked yet (before, it took the first
  one even if it was already ticked, so nothing seemed to happen).

## 0.14.7
- The opening screen no longer reserves a fixed 500 px: it measures the genre menu and keeps just that room (plus a margin), so with few
  genres found there is much less white space, and it is still tall enough for the menu to open without pushing Bandcamp's footer.

## 0.14.6
- Opening screen: "Pick one to start." now comes before the buttons (it replaces "Pick a mood, or let us pick for you."); under the buttons
  there is only the description of the list you picked.

## 0.14.5
- Fix: Best matches says "Perfect matches with your collection" (it said "for").

## 0.14.4
- Shorter descriptions of the lists: "Explore new music by genre." (My tags), "Perfect matches with your collection." (Best matches) and
  "Go beyond your collection." (Surprise me).

## 0.14.3
- The descriptions of the three lists say what each one is for: My tags ("Discover other music based on your favorite genres"), Best
  matches ("Discover new music based on your collection") and Surprise me ("Music that goes beyond your collection: explore similar music
  and genres").

## 0.14.2
- New, shorter descriptions of the three lists (tooltips, opening screen, About, README and the store text): My tags, Best matches and
  Surprise me.

## 0.14.1
- The "next album" button is gone from the player bar. The "next" arrow next to the time already moves to the next album in "one song per
  album", and the album's next song in "full album".

## 0.14.0
- **Liked Songs on the cards.** A + next to the heart on each card adds the song the album starts with (the featured one, or the first) to
  Liked Songs; it turns into a green check ring when a song of that album is in the list, and a second click takes the album's songs out.
- **Bandcamp's own check mark.** The check inside the ring (cards, player bar and list) is the one Bandcamp uses for "following", scaled
  into the ring, instead of the generic one.
- **Same buttons everywhere.** The heart, the + and the ⊘ have the same size (18 px) and spacing (12 px) on the cards and in the player bar.
- **Player bar.** A "·" after the heart, and the same space (16 px) between all the elements on the right side (Playback, next album,
  queue, Liked Songs, volume and the separators).

## 0.13.1
- The Playback button is centred vertically on the player bar, on the same line as the icons next to it (next album, queue, Liked Songs,
  volume) and the separators. They all sit on the middle of the bar now (the whole group moved up by 1 px).

## 0.13.0
- Each way to play has its own icon, on the Playback button and in its list: a **music note** for one song per album, and Bandcamp's
  collection icon (the record box) turned 90° to the right for whole albums. In a narrow window (up to 1,150 px) the button shows only the
  icon and the arrow, so it does not run into the time counter; the tooltip and the list have the names.

## 0.12.2
- Once a song is in Liked Songs, the + becomes a filled circle with a check mark (green), in the player bar and in the list.

## 0.12.1
- The + of the player bar says "Add to Liked Songs" and, once the song is in the list, "Remove from Liked Songs" (a second click takes it out).
  The same wording in the list and in the messages.

## 0.12.0
- The playback choice is now a **"Playback" button** with the name of the mode ("One per album" / "Full album"), in the place the shuffle
  button was. It opens a short list upwards (with "One song per album" and "Full album", a tick on the one that is on); the list closes when
  you pick, click outside or press Esc.
- **Shuffle is gone** completely (the button, the code and its tests): a list plays in order, one song per album by default.

## 0.11.0
- **Type of playback.** A new button in the player bar, next to "next album", switches between **one song per album** (the default: the song
  the artist features, or the first one, of each album in the order of the list, the way Bandcamp's own lists play) and **whole albums**
  (the way it used to be). The choice is remembered. It shows a note (blue) for one song per album and a disc for whole albums.
- In one song per album, "next" and "previous" move between albums, a song that ends goes on to the next album's, and there is **no
  shuffle** (its button is hidden). Shuffle is back when you switch to whole albums.

## 0.10.1
- On the opening screen no option is selected to begin with ("Best matches" used to be). "Start digging" stays off until one is picked
  (and, for "My tags", until at least one genre is ticked).

## 0.10.0
- **Liked list (songs).** A **+** next to the heart in the player bar adds the song that is playing to your Liked list (green when it is
  there; a second click takes it out). A bookmark button in the bar opens the list: most recent first, each song can be played (it starts
  that track), have its album added to the wishlist (heart) or be taken out (the green +). It is only on the player bar, not on the cards.
- **It feeds the search.** The albums of the songs in the list count like the library: they are read for their recommendations and tags
  at once, weigh in your taste, are used as the albums a genre list starts from, and never come back as recommendations.
- **More variety.** Albums to read are now drawn at random from the whole library (the recent ones no longer have an edge), and "Best
  matches" draws from the top 150 instead of always taking the top 50, so a fresh install (or a new day) gives a different list. In genre
  lists, albums that tie are put in a random order. "Surprise me" never repeats an album of the best list.

## 0.9.2
- Umbrella genres (the ones that cover many sub-genres: electronic, rock, pop, ambient, folk, jazz, classical, hip hop, dance, experimental,
  indie...) are ignored: they are not offered in "My tags", typing one does not offer to add it, a list is never built around one (or only
  with the specific genres picked next to it), and they no longer count when judging how well an album fits your taste.

## 0.9.1
- Hiding an album from inside a genre list now holds only for lists of those genres: the album, its artist and the albums Bandcamp pairs
  with it stay out of lists that share one of those genres, but can still show up in the daily lists and in lists of other genres. The
  taste thermometer is not touched either. Hiding an album anywhere else works for every list, as before (and hiding it again outside a
  genre list makes it global).

## 0.9.0
- Genre lists are less strict, because they were coming out too short:
  - the genre may be among the album's **first four** tags (it was three);
  - when a list still has fewer than **20** albums, it looks one step further: at the albums of that genre that Bandcamp recommended
    (read in batches of 40, up to three times). They come after the albums that come straight from yours, they only need to carry the
    genre, and their tags don't enter your taste profile.
- A list with 20 or more albums is still not filled up to 50 with albums that don't match.

## 0.8.8
- In the player bar, the name of the album and the artist are underlined when you hover over them (both together, like on the cards).

## 0.8.7
- The shuffle button at the top of the page is gone; shuffle is only in the player bar.

## 0.8.6
- The shuffle icon is back to the first one (Material "shuffle": straight diagonals and solid arrow heads), on the page and in the player bar.

## 0.8.5
- Shuffle icon: the line that goes behind is shorter, as in Spotify's. Both of its pieces now stop the same distance from the crossing
  (before, one of them almost touched the front line), leaving an even gap on each side.

## 0.8.4
- The shuffle icon follows the Spotify one more closely (drawn over a picture of it): straight 45° diagonals in an X, short flat ends and
  open arrow heads, and a thinner stroke (1.25 on a 24 × 24 grid).

## 0.8.3
- A new, thinner shuffle icon (page and player bar): the shape Spotify uses, two crossing arrows with open heads, drawn with a 1.5 stroke on
  a square grid. It replaces the Bandcamp-app-style one.

## 0.8.2
- The shuffle icon (page and player bar) is drawn on a square grid, so it fills the square button instead of looking flat: same shapes
  as before (straight line ends, sharp arrow corners), just taller.

## 0.8.1
- The "don't show music like this" icon no longer turns into a "+": it keeps the same icon, turns red while it is on, and a second click
  brings the album back (cards, queue and player bar).

## 0.8.0
- Simpler feedback. The thumbs up and the list of liked albums are gone; the card has the **heart** (Bandcamp wishlist) and the **⊘**
  (the icon is back). The ⊘ now means **"don't show music like this"**: the album stays hidden, and so do its artist and the albums
  Bandcamp pairs with it ("you may also like" of that album, read once when you hide it). Undoing it brings everything back.
- The hide made inside a genre list no longer counts double or penalises tags (0.6.2); the new rule above replaces it.
- Albums liked in older versions keep working as before.

## 0.7.3
- Faster genre lists: when a list comes out short, the genre tags of more candidates are read in steps of 50 (up to 300), and it stops
  after two steps that found no new album, instead of always reading all 300.

## 0.7.2
- Faster lists: the library (collection + wishlist) is no longer read page by page every time. The profile page already says how many
  items there are and which are the newest, so when that is what was saved, the saved copy is used (one request instead of one per 100
  items). A purchase or a save makes it read everything again, and so does a copy older than a week.

## 0.7.1
- Faster lists: the genre tags of a candidate album are remembered (up to 1,500 albums, for 30 days), so the same album is not read again in
  the next list, the next day or in a genre list. The lists themselves do not change, they only need fewer requests to Bandcamp.

## 0.7.0
- Lists built around genres now only hold close matches, for any genre you pick (think of a DJ digging for a sound):
  - the genre must be one of the album's **first three tags**; a tag far down the list no longer counts;
  - the list is **not filled up to 50** any more: it has as many albums as match (the extra reads of recommended albums that 0.4.15 added
    are gone, and albums whose genre was never checked are left out);
  - the albums that more of **your** albums of that genre recommend come first, and with several genres picked, the ones that match more
    of them come first.
- The daily lists ("Best matches" and "Surprise me") are not changed: they are still 50 long.

## 0.6.3
- Fix: hiding the album that is playing sometimes took a while to skip. The page waited for the background worker to confirm the dislike
  before moving on, and the worker answers only after the job it is busy with (a scan, a list being built). Now the next album (or the
  next shuffled track) starts at once, and the dislike and the replacement album are sent in the background, in the same order.

## 0.6.2
- Hiding an album from a genre list now says more: it is further from the genres that were selected. The dislike counts twice for where the
  album came from, and the other tags the album had besides the genre are held against the albums that come next in lists of those same
  genres (they go to the end of the list; they are not removed). Nothing changes in other lists, and the taste profile is not touched.
  Undoing the dislike undoes all of it.

## 0.6.1
- A shuffle button next to the play button at the top of the page: it turns shuffle on and off like the one in the player bar (blue when
  on), and both always show the same state. Both use the shuffle icon of Bandcamp's app: straight cut line ends and sharp arrow corners.

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
