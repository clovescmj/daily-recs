// Album card markup and the in-place updates of its wishlist / dislike controls.
import { esc, safeUrl } from './dom.js';
import { ADD_CIRCLE, BLOCK, CHECK_CIRCLE, HEART, HEART_FILLED, decorativeIcon, dislikeLabel, labelledIcon, saveLabel, wishlistLabel } from './icons.js';

/** `album`: a candidate from the state pool. `flags`: { wished (in the wishlist), saved (a song of it is in Liked Songs), disliked }. */
export function cardHtml(album, { wished = false, saved = false, disliked }) {
  const url = esc(safeUrl(album.url));
  const title = esc(album.title);
  const reason = album.via ? `People who own “${esc(album.via)}” also own` : '';
  const fans = album.fans ? ` · ${album.fans} fans in common` : '';
  const wishlistText = wishlistLabel(wished);
  const saveText = saveLabel(saved);
  const dislikeText = dislikeLabel(disliked);
  return `<article class="album-card${disliked ? ' is-disliked' : ''}" data-id="${album.id}" data-title="${title}">
    <div class="album-cover">
      <a href="${url}" target="_blank" rel="noopener" data-open><img src="${esc(safeUrl(album.art))}" alt="Cover of ${title} by ${esc(album.artist)}" loading="lazy"></a>
      <button type="button" class="cover-play" data-play title="Play here" aria-label="Play ${title} by ${esc(album.artist)}">▶</button>
      <span class="cover-badge" title="This album won't be shown again" aria-hidden="true">${decorativeIcon(BLOCK)}</span>
    </div>
    <div class="album-body">
      <a class="album-title" href="${url}" target="_blank" rel="noopener" data-open>${title}</a>
      <a class="album-artist" href="${url}" target="_blank" rel="noopener" data-open>${esc(album.artist)}</a>
      <div class="album-reason">${reason}${fans}</div>
      <div class="album-actions">
        <a href="#" class="dr-act dr-act--wish action-wishlist${wished ? ' is-on' : ''}" data-wish title="${wishlistText}" aria-label="${wishlistText}: ${title}">${labelledIcon(wished ? HEART_FILLED : HEART, wishlistText)}</a>
        <a href="#" class="dr-act dr-act--save action-save${saved ? ' is-on' : ''}" data-save title="${saveText}" aria-label="${saveText}: ${title}">${labelledIcon(saved ? CHECK_CIRCLE : ADD_CIRCLE, saveText)}</a>
        <a href="#" class="dr-act dr-act--dislike action-dislike${disliked ? ' is-on' : ''}" data-dislike title="${dislikeText}" aria-label="${dislikeText}: ${title}">${labelledIcon(BLOCK, dislikeText)}</a>
      </div>
    </div>
  </article>`;
}

export const findCard = (id) => document.querySelector(`.album-card[data-id="${id}"]`);
export const visibleCardIds = () => [...document.querySelectorAll('.album-card:not(.is-disliked)')].map((card) => card.dataset.id);

/** Updates the state of one control of a card: its colour, its icon and its label. */
function paintControl(card, selector, on, path, label) {
  const link = card.querySelector(selector);
  link.classList.toggle('is-on', on);
  link.querySelector('path').setAttribute('d', path);
  link.title = label;
  link.setAttribute('aria-label', `${label}: ${card.dataset.title}`);
  link.querySelector('title').textContent = label;
}

export const paintSave = (card, on) => paintControl(card, '[data-save]', on, on ? CHECK_CIRCLE : ADD_CIRCLE, saveLabel(on));
export const paintWish = (card, on) => paintControl(card, '[data-wish]', on, on ? HEART_FILLED : HEART, wishlistLabel(on));

/** Dislike: the album is dimmed (the wishlist is not touched). */
export function paintDislike(card, on) {
  card.classList.toggle('is-disliked', on);
  paintControl(card, '[data-dislike]', on, BLOCK, dislikeLabel(on));
}
