// Draws the page from the stored state and the run status.
import { hiddenIn, tagListKey, todayKey } from '../../lib/state.js';
import { cardHtml, findCard, paintDislike, paintWish } from './cards.js';
import { $ } from './dom.js';
import { emit, markPlaying } from './player.js';
import { session } from './session.js';
import { renderStatus } from './status-line.js';
import { renderViewSwitch } from './views.js';
import { flushWishlistQueue } from './wishlist-actions.js';

let renderedKey = '';   // signature of the album list currently in the grid

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
export const currentList = (state) => listFor(state, session.view, session.tagKeys) || (session.view === 'best' ? null : listFor(state, 'best'));

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

  if (!list) { setEmpty(status.running || status.error ? '' : 'Getting your recommendations ready…'); return; }
  if (!ids.length) { setEmpty('Nothing new for now. Come back tomorrow.'); return; }

  // Rebuild the cards only when the list itself changed; otherwise just sync the wishlist / dislike controls.
  const key = ids.join(',');
  if (key !== renderedKey) {
    $('album-grid').innerHTML = ids.map((id) => cardHtml(state.pool[id], {
      wished: session.wished.has(id), disliked: session.dislikedThisVisit.has(id),
    })).join('');
    renderedKey = key;
  } else {
    for (const id of ids) {
      const card = findCard(id);
      if (!card) continue;
      paintWish(card, session.wished.has(id));
      paintDislike(card, session.dislikedThisVisit.has(id));
    }
  }
  markPlaying();
}

export function render(state, status) {
  session.state = state;
  const running = Boolean(status.running);
  renderViewSwitch(state, status);
  renderStatus(status);
  renderGrid(state, status);
  $('play-all').hidden = !session.hasList;
  emit(true);
  if (state && state.wishQueue && state.wishQueue.length) flushWishlistQueue();
}
