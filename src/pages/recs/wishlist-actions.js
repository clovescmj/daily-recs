// Wishlist / like / dislike. The heart toggles the Bandcamp wishlist (the only control that changes the user's Bandcamp
// account); the thumbs only teach the taste: the like asks for more like it, the dislike hides the album. Wishlist changes
// are made by Bandcamp's own function, run inside the profile tab.
import { MSG } from '../../lib/messages.js';
import { findCard, paintDislike, paintLike, paintWish, visibleCardIds } from './cards.js';
import { loadState, send } from './data.js';
import { requestWishlistOp } from './host-bridge.js';
import { continueAfterRemoval, currentId, emit, isShuffling, playAlbum } from './player.js';
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

/** Thumbs up: "See more like this". Only teaches the taste; liking an album that was hidden brings it back first. */
export async function setLike(id, on) {
  if (on && session.dislikedThisVisit.has(id)) await undoDislike(id);
  if (on) session.liked.add(id); else session.liked.delete(id);
  const card = findCard(id);
  if (card) paintLike(card, on);
  emit(true);
  await send({ type: MSG.FEEDBACK, id, kind: on ? 'like' : 'unlike' });
}

export async function dislikeAlbum(id) {
  const ids = visibleCardIds();
  const nextId = ids[ids.indexOf(id) + 1];
  const wasPlaying = currentId() === id;
  session.liked.delete(id);
  session.dislikedThisVisit.add(id);
  const card = findCard(id);
  if (card) paintDislike(card, true);
  await send({ type: MSG.FEEDBACK, id, kind: 'dislike' }); // the wishlist is not touched: only the heart changes it
  await replaceHidden(wasPlaying, nextId);
  emit(true);
}

/** Asks for one new album at the end of the current list, in the background: it can take a while, so nothing waits for it. */
const requestReplacement = () => send({ type: MSG.EXTEND_LIST, view: session.view, tags: session.tagKeys })
  .then((reply) => (reply && reply.ok ? reply.id : null))
  .catch(() => null);

/**
 * A hidden album is replaced by a new one at the end of the list (in shuffle it simply joins the albums that are left to
 * play). Playback never waits for it: if the hidden album was playing, the next one starts right away. Only when the hidden
 * album was the last one does the new album play, as soon as it arrives.
 */
async function replaceHidden(wasPlaying, nextId) {
  const replacement = requestReplacement();
  if (!wasPlaying) return;
  continueAfterRemoval(nextId);
  if (!nextId && !isShuffling()) replacement.then((id) => id && playAlbum(id));
}

/** Back to neutral (the like that the dislike replaced is not restored). */
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
