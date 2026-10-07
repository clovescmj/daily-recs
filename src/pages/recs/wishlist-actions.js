// Like / dislike / wishlist. The heart toggles the Bandcamp wishlist AND the taste; the dislike hides the album,
// teaches the taste and removes it from the wishlist when it was there. Wishlist changes are made by Bandcamp's own
// function, run inside the profile tab.
import { MSG } from '../../lib/messages.js';
import { findCard, paintDislike, paintLike, visibleCardIds } from './cards.js';
import { loadState, send } from './data.js';
import { requestWishlistOp } from './host-bridge.js';
import { continueAfterRemoval, currentId, emit } from './player.js';
import { session } from './session.js';
import { toast } from './toast.js';

const busyHearts = new Set();
const failedThisLoad = new Set();   // queued adds that failed in this page load: retry on the next one
let flushing = false;

const poolAlbum = async (id) => ((await loadState()) || { pool: {} }).pool[id];

/** Heart: wishlist + like. Adding counts only if Bandcamp confirms; removing is best effort. */
export async function setLike(id, on) {
  if (busyHearts.has(id)) return;
  const album = await poolAlbum(id);
  if (!album) return;
  busyHearts.add(id);
  const card = findCard(id);
  if (card) paintLike(card, on); // optimistic; rolled back on failure
  try {
    const result = await requestWishlistOp(on ? 'add' : 'remove', album);
    if (!result.ok && on) {
      if (card) paintLike(card, false);
      toast("Couldn't add it to your wishlist. Try again.");
      return;
    }
    toast(result.ok ? (on ? 'Album added to your wishlist. Reload the page to see it in your wishlist tab.' : 'Album removed from your wishlist') : "Unliked. Couldn't confirm the wishlist removal.");
    if (on) session.liked.add(id); else session.liked.delete(id);
    send({ type: MSG.FEEDBACK, id, kind: on ? 'like' : 'unlike' });
    emit(true);
  } finally {
    busyHearts.delete(id);
  }
}

export async function dislikeAlbum(id) {
  const ids = visibleCardIds();
  const nextId = ids[ids.indexOf(id) + 1];
  const wasPlaying = currentId() === id;
  const hadHeart = session.liked.has(id);
  const album = await poolAlbum(id);
  session.liked.delete(id);
  session.dislikedThisVisit.add(id);
  const card = findCard(id);
  if (card) paintDislike(card, true);
  await send({ type: MSG.FEEDBACK, id, kind: 'dislike' });
  if (hadHeart && album) {
    const result = await requestWishlistOp('remove', album);
    if (result.ok) toast('Album removed from your wishlist');
    else await send({ type: MSG.WISHLIST_QUEUE, op: 'remove', id, bandId: album.artistId }); // retry later
  }
  if (wasPlaying) continueAfterRemoval(nextId);
  emit(true);
}

/** Back to neutral. Neither the heart nor the wishlist entry is restored (the dislike had removed them). */
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
