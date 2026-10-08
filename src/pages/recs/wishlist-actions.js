// Wishlist / dislike. The heart toggles the Bandcamp wishlist (the only control that changes the user's Bandcamp account); the
// thumb down says "don't show music like this". Wishlist changes are made by Bandcamp's own function, run inside the profile tab.
import { MSG } from '../../lib/messages.js';
import { findCard, paintDislike, paintWish, visibleCardIds } from './cards.js';
import { loadState, send } from './data.js';
import { requestWishlistOp } from './host-bridge.js';
import { albumSongs, continueAfterRemoval, currentId, emit, playAlbum } from './player.js';
import { session } from './session.js';
import { toast } from './toast.js';

const busyHearts = new Set();
const failedThisLoad = new Set();   // queued adds that failed in this page load: retry on the next one
let flushing = false;

const poolAlbum = async (id) => ((await loadState()) || { pool: {} }).pool[id];

/** Heart: the Bandcamp wishlist. Adding counts only if Bandcamp confirms; removing is best effort. */
export async function setWish(id, on) {
  if (busyHearts.has(id)) return;
  const album = await poolAlbum(id);
  if (!album) return;
  busyHearts.add(id);
  const card = findCard(id);
  if (card) paintWish(card, on); // optimistic; rolled back on failure
  try {
    const result = await requestWishlistOp(on ? 'add' : 'remove', album);
    if (!result.ok && on) {
      if (card) paintWish(card, false);
      toast("Couldn't add it to your wishlist. Try again.");
      return;
    }
    toast(result.ok ? (on ? 'Album added to your wishlist. Reload the page to see it in your wishlist tab.' : 'Album removed from your wishlist') : "Couldn't confirm the wishlist removal.");
    if (on) session.wished.add(id); else session.wished.delete(id);
    send({ type: MSG.FEEDBACK, id, kind: on ? 'wish' : 'unwish' });
    emit(true);
  } finally {
    busyHearts.delete(id);
  }
}

/** The + of the player bar: adds a song to (or takes it out of) Liked Songs. Its album then feeds the search like the library does. */
export async function setSave({ id, i, title }, on) {
  await setSongs([{ id, i, title }], on, on ? 'Added to Liked Songs' : 'Removed from Liked Songs');
}

async function setSongs(songs, on, message) {
  for (const { id, i } of songs) { if (on) session.saved.add(`${id}:${i}`); else session.saved.delete(`${id}:${i}`); }
  emit(true);
  toast(message);
  for (const { id, i, title } of songs) await send({ type: MSG.FEEDBACK, id, kind: on ? 'save' : 'unsave', index: i, track: String(title || '').slice(0, 200) });
}

/** The + of a card: adds all the songs of the album to Liked Songs, or, when a song of it is already there, takes the album out. */
export async function saveAlbumSong(id) {
  const keys = [...session.saved].filter((key) => key.startsWith(`${id}:`));
  if (keys.length) { // already in: take the album's songs out
    const saved = ((await loadState()) || {}).saved || [];
    const songs = keys.map((key) => Number(key.split(':')[1])).map((i) => ({ id, i, title: (saved.find((item) => item.id === id && item.i === i) || {}).title }));
    await setSongs(songs, false, 'Removed album from Liked Songs');
    return;
  }
  const songs = await albumSongs(id).catch(() => []);
  if (!songs.length) { toast("Couldn't read this album's songs. Try again."); return; }
  await setSongs(songs, true, 'Added album to Liked Songs');
}

export async function dislikeAlbum(id) {
  const ids = visibleCardIds();
  const nextId = ids[ids.indexOf(id) + 1];
  const wasPlaying = currentId() === id;
  session.dislikedThisVisit.add(id);
  const card = findCard(id);
  if (card) paintDislike(card, true);
  // Nothing below waits for the extension's background worker: it may be busy with a long job (a scan, a list being built) and
  // would only answer when it is done, and the music has to skip right now. The requests keep their order.
  // "Don't show music like this": the album, its artist and what is closely tied to it stop coming. Inside a genre list that holds only for lists
  // of those genres (the genres go along); anywhere else it holds everywhere. The wishlist is not touched: only the heart changes it.
  const feedback = send({ type: MSG.FEEDBACK, id, kind: 'dislike', ...(session.view === 'tags' ? { tags: session.tagKeys } : {}) }).catch(() => undefined);
  const replacement = requestReplacement();
  if (wasPlaying) {
    continueAfterRemoval(nextId);
    if (!nextId) replacement.then((newId) => newId && playAlbum(newId)); // it was the last one: the new album plays when it arrives
  }
  emit(true);
  await feedback;
}

/**
 * Asks for one new album at the end of the current list, in the background: it can take a while, so nothing waits for it.
 */
const requestReplacement = () => send({ type: MSG.EXTEND_LIST, view: session.view, tags: session.tagKeys })
  .then((reply) => (reply && reply.ok ? reply.id : null))
  .catch(() => null);

/** Back to neutral. */
export async function undoDislike(id) {
  session.dislikedThisVisit.delete(id);
  const card = findCard(id);
  if (card) paintDislike(card, false);
  emit(true);
  await send({ type: MSG.FEEDBACK, id, kind: 'undislike' });
}

/** Runs requests saved earlier (removals that failed) now that the profile tab is open. */
export async function flushWishlistQueue() {
  if (flushing) return;
  flushing = true;
  let added = 0;
  try {
    for (;;) {
      const queue = ((await loadState()) || {}).wishQueue || [];
      const entry = queue.find((item) => !failedThisLoad.has(item.id));
      if (!entry) break;
      const result = await requestWishlistOp(entry.op, { id: entry.id, artistId: entry.bandId });
      if (!result.ok && entry.op === 'add') { failedThisLoad.add(entry.id); continue; }
      if (result.ok && entry.op === 'add') added++;
      await send({ type: MSG.WISHLIST_DONE, id: entry.id });
    }
    if (added) toast(added === 1 ? 'Album added to your wishlist. Reload the page to see it there.' : `${added} albums added to your wishlist. Reload the page to see them there.`);
  } finally {
    flushing = false;
  }
}
