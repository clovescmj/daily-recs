// Draws the page from the stored state and the run status.
import { DAILY_COUNT, todayKey } from '../../lib/state.js';
import { cardHtml, findCard, paintDislike, paintLike } from './cards.js';
import { $ } from './dom.js';
import { SPARKLES_ICON, TARGET_ARROW_ICON } from './icons.js';
import { emit, markPlaying } from './player.js';
import { session } from './session.js';
import { renderStatus } from './status-line.js';
import { flushWishlistQueue } from './wishlist-actions.js';

let renderedKey = '';   // signature of the album list currently in the grid

function setEmpty(message) {
  $('album-grid').innerHTML = message ? `<div class="empty-state">${message}</div>` : '';
  renderedKey = '';
}

const isFromToday = (list) => Boolean(list && list.date === todayKey());

/** The list on screen: the surprise one when chosen and available, otherwise the best matches. */
export function currentList(state, view = session.view) {
  if (!state) return null;
  if (view === 'surprise' && isFromToday(state.surprise)) return state.surprise;
  return isFromToday(state.today) ? state.today : null;
}

/** Albums of the current list that should be on the page: not dismissed (unless dismissed during this visit). */
function visibleAlbumIds(state, list) {
  const dismissed = new Set(state.dismissed || []);
  return list.ids.filter((id) => !dismissed.has(id) || session.dislikedThisVisit.has(id));
}

function renderGrid(state, status) {
  const list = currentList(state);
  const ids = list ? visibleAlbumIds(state, list) : [];
  session.hasList = Boolean(list) && list.ids.some((id) => !(state.dismissed || []).includes(id));
  session.liked = new Set(state ? state.liked || [] : []);

  if (!list) { setEmpty(status.running || status.error ? '' : 'Getting your recommendations ready…'); return; }
  if (!ids.length) { setEmpty('Nothing new for now. Come back tomorrow.'); return; }

  // Rebuild the cards only when the list itself changed; otherwise just sync the like/dislike controls.
  const key = ids.join(',');
  if (key !== renderedKey) {
    $('album-grid').innerHTML = ids.map((id) => cardHtml(state.pool[id], {
      liked: session.liked.has(id), disliked: session.dislikedThisVisit.has(id),
    })).join('');
    renderedKey = key;
  } else {
    for (const id of ids) {
      const card = findCard(id);
      if (!card) continue;
      paintLike(card, session.liked.has(id));
      paintDislike(card, session.dislikedThisVisit.has(id));
      if (session.dislikedThisVisit.has(id)) paintLike(card, false);
    }
  }
  markPlaying();
}

const TOGGLE_HELP = {
  surprise: `Reads new albums from your collection and picks ${DAILY_COUNT} from deeper in the ranking, away from the obvious. Likes and dislikes still apply. Your best matches stay saved.`,
  best: 'Back to your best matches, the albums your collection and wishlist point to the most. Nothing is reloaded.',
};

/** One button: "Surprise me" while looking at the best matches, "Best matches" while looking at the surprise list. */
function renderModeToggle(state, status) {
  const button = $('mode-toggle');
  const target = session.view === 'surprise' && isFromToday(state && state.surprise) ? 'best' : 'surprise';
  if (button.dataset.target !== target) { // only rewrite the button when it actually changes
    button.dataset.target = target;
    button.innerHTML = `${target === 'best' ? TARGET_ARROW_ICON : SPARKLES_ICON}<span>${target === 'best' ? 'Best matches' : 'Surprise me'}</span>`;
  }
  button.title = TOGGLE_HELP[target];
  $('mode-help').textContent = TOGGLE_HELP[target];
  button.disabled = Boolean(status.running);
}

export function render(state, status) {
  session.state = state;
  const running = Boolean(status.running);
  renderModeToggle(state, status);
  renderStatus(status);
  renderGrid(state, status);
  $('play-all').hidden = !session.hasList;
  emit(true);
  if (state && state.wishQueue && state.wishQueue.length) flushWishlistQueue();
}
