// The Liked Songs list: tracks as { id (album), i (track number), title }, newest last.
// It lives under its own storage key (`likedSongs`), apart from the big `state`, and it only ever changes when the user adds or removes a song:
// a run, a migration or a state that had to be rebuilt can never reset it. The pages write it straight away (not through the service worker,
// whose queue waits for a run to end and whose memory is lost when the browser stops it); `state.saved` is a copy of it for the recommender.
import { LIKED_KEY } from './storage-keys.js';

const chains = new WeakMap();   // storage area -> the last change, so two changes at once are applied one after the other

/** The stored list, or null when there is none yet (a state saved by an older version kept it inside). */
export async function loadLiked(area) {
  const stored = (await area.get(LIKED_KEY))[LIKED_KEY];
  return Array.isArray(stored) ? stored : null;
}

/** The list with `songs` added (or taken out): a song is one album and one track number, and it is never there twice. */
export function withSongs(list, songs, on) {
  let result = list;
  for (const { id, i, title } of songs) {
    result = result.filter((entry) => !(entry.id === id && entry.i === i));
    if (on) result.push({ id, i, title });
  }
  return result;
}

/**
 * Adds or removes songs and writes the list at once. `fallback()` is the list kept inside the state by an older version: the first change
 * starts from it, so nothing is lost on the way to the separate key.
 */
export function changeLiked(area, songs, on, fallback = () => []) {
  const run = async () => {
    const list = (await loadLiked(area)) || [...(await fallback())];
    const next = withSongs(list, songs, on);
    await area.set({ [LIKED_KEY]: next });
    return next;
  };
  const chain = (chains.get(area) || Promise.resolve()).then(run, run);
  chains.set(area, chain.catch(() => {}));
  return chain;
}

/** Puts the stored list into the state (the copy the recommender reads). A state is never allowed to overwrite the stored list. */
export function mirrorLiked(state, liked) {
  if (state && Array.isArray(liked)) state.saved = liked;
  return state;
}
