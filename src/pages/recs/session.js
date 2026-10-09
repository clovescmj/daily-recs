// State shared by the page modules. Kept in one place so every module sees the same values and nothing depends on
// module evaluation order.
export const HOST_ORIGIN = 'https://bandcamp.com';

export const session = {
  /** Which saved list is on screen: 'best' (always on open), 'surprise' or 'tags'. Switching costs nothing once a list exists. */
  view: 'best',
  /** Genres of the 'tags' list on screen (normalised keys). */
  tagKeys: [],
  /** True while the opening screen ("What do you want to hear today?") is showing. */
  landing: false,
  /** A list that is being built: { view, keys, sawRunning }. The page switches to it as soon as it is ready. */
  pending: null,
  /** Latest `state` read from storage (null until loaded). */
  state: null,
  /** Albums disliked during this visit: they stay on the page (dimmed) so the dislike can be undone. */
  dislikedThisVisit: new Set(),
  /** Tracks in the Liked list, as "albumId:trackNumber" (the + of the player bar). */
  saved: new Set(),
  /** Albums the user put in the wishlist from here (the heart). */
  wished: new Set(),
  /** True when a list for today exists, which is when the player bar is shown even if nothing is playing. */
  hasList: false,
  /** True until a list has been drawn: nothing was on screen yet, so there is no other list to show while the chosen one is built. */
  fresh: true,
  /** True while a run is building a list: the loading box offers a song to listen to meanwhile. */
  running: false,
};
