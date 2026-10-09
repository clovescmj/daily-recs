// Draws the page from the stored state and the run status.
import { hiddenIn, tagListKey, todayKey } from '../../lib/state.js';
import { cardHtml, findCard, paintDislike, paintSave, paintWish } from './cards.js';
import { $ } from './dom.js';
import { emit, markPlaying } from './player.js';
import { session } from './session.js';
import { renderStatus } from './status-line.js';
import { waiting } from './waiting.js';
import { renderViewSwitch } from './views.js';
import { flushWishlistQueue } from './wishlist-actions.js';

let renderedKey = '';   // signature of the album list currently in the grid

const SKELETON_ROWS = 2;
const skeletonCard = (index) => `<div class="skeleton" style="--i:${index}" aria-hidden="true"><div class="skeleton-cover"></div><div class="skeleton-line wide"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`;

/** As many placeholders as fill whole rows of the grid, whatever the width of the window (no half-empty last row). */
function skeletonCount() {
  const columns = getComputedStyle($('album-grid')).gridTemplateColumns.split(' ').filter(Boolean).length || 4;
  return columns * SKELETON_ROWS;
}

/** While the list is being built: placeholders where the albums will be, so the page does not jump when they arrive. */
function setSkeleton() {
  const count = skeletonCount();
  if (renderedKey === `skeleton:${count}`) return;
  $('album-grid').innerHTML = Array.from({ length: count }, (_, index) => skeletonCard(index)).join('');
  renderedKey = `skeleton:${count}`;
}
addEventListener('resize', () => { if (renderedKey.startsWith('skeleton')) setSkeleton(); }); // a narrower or wider window: whole rows again

function setEmpty(message) {
  $('album-grid').innerHTML = message ? `<div class="empty-state">${message}</div>` : '';
  renderedKey = '';
}

const isFromToday = (list) => Boolean(list && list.date === todayKey());

/** Today's list for a view ('best', 'surprise', or 'tags' with its genres), or null when it hasn't been built. */
export function listFor(state, view, keys = []) {
  if (!state) return null;
  const list = view === 'surprise' ? state.surprise : view === 'tags' ? (state.tagLists || {})[tagListKey(keys)] : state.today;
  return isFromToday(list) ? list : null;
}

/** The list on screen. */
export const currentList = (state) => listFor(state, session.view, session.tagKeys) || (session.view === 'best' || session.fresh ? null : listFor(state, 'best'));

/** Albums of the current list that should be on the page: not hidden (unless hidden during this visit). */
function visibleAlbumIds(state, list) {
  return list.ids.filter((id) => !hiddenIn(state, id, list) || session.dislikedThisVisit.has(id));
}

function renderGrid(state, status) {
  const list = currentList(state);
  const ids = list ? visibleAlbumIds(state, list) : [];
  session.hasList = Boolean(list) && list.ids.some((id) => !hiddenIn(state, id, list));
  session.wished = new Set(state ? state.wishlisted || [] : []);
  session.saved = new Set((state ? state.saved || [] : []).map((entry) => `${entry.id}:${entry.i}`)); // the Liked list: tracks
  session.savedAlbums = new Set((state ? state.saved || [] : []).filter((entry) => entry.all).map((entry) => entry.id));

  if (list) session.fresh = false;
  if (!list && (status.running || session.pending) && !session.landing) { setSkeleton(); return; } // a list was asked for: its placeholders, not a message
  if (!list) { setEmpty(status.error ? '' : 'Getting your recommendations ready…'); return; }
  if (!ids.length) { setEmpty('Nothing new for now. Come back tomorrow.'); return; }

  // Rebuild the cards only when the list itself changed; otherwise just sync the wishlist / dislike controls.
  const key = ids.join(',');
  if (key !== renderedKey) {
    $('album-grid').innerHTML = ids.map((id) => cardHtml(state.pool[id], {
      wished: session.wished.has(id), saved: session.savedAlbums.has(id), disliked: session.dislikedThisVisit.has(id),
    })).join('');
    renderedKey = key;
  } else {
    for (const id of ids) {
      const card = findCard(id);
      if (!card) continue;
      paintWish(card, session.wished.has(id));
      paintSave(card, session.savedAlbums.has(id));
      paintDislike(card, session.dislikedThisVisit.has(id));
    }
  }
  markPlaying();
}

export function render(state, status) {
  session.state = state;
  const running = Boolean(status.running);
  const wasRunning = session.running; // (renderStatus below updates it)
  renderViewSwitch(state, status);
  renderStatus(status);
  renderGrid(state, status);
  $('play-all').hidden = !session.hasList;
  if (wasRunning && !running) waiting.finish(); // a song played while waiting: now the list plays
  emit(true);
  if (state && state.wishQueue && state.wishQueue.length) flushWishlistQueue();
}
