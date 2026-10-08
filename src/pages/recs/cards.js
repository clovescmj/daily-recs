// Album card markup and the in-place updates of its like/dislike controls.
import { esc, safeUrl } from './dom.js';
import { BLOCK, HEART, HEART_FILLED, THUMB_DOWN, THUMB_DOWN_FILLED, THUMB_UP, THUMB_UP_FILLED, decorativeIcon, dislikeLabel, labelledIcon, likeLabel, wishlistLabel } from './icons.js';

/** `album`: a candidate from the state pool. `flags`: { wished (in the wishlist), liked, disliked }. */
export function cardHtml(album, { wished = false, liked, disliked }) {
  const url = esc(safeUrl(album.url));
  const title = esc(album.title);
  const reason = album.via ? `People who own “${esc(album.via)}” also own` : '';
  const fans = album.fans ? ` · ${album.fans} fans in common` : '';
  const wishlistText = wishlistLabel(wished);
  const likeText = likeLabel(liked);
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
        <a href="#" class="action-wishlist${wished ? ' is-on' : ''}" data-wish title="${wishlistText}" aria-label="${wishlistText}: ${title}">${labelledIcon(wished ? HEART_FILLED : HEART, wishlistText)}</a>
        <span class="action-rate">
          <a href="#" class="action-like${liked ? ' is-on' : ''}" data-like title="${likeText}" aria-label="${likeText}: ${title}">${labelledIcon(liked ? THUMB_UP_FILLED : THUMB_UP, likeText)}</a>
          <a href="#" class="action-dislike${disliked ? ' is-on' : ''}" data-dislike title="${dislikeText}" aria-label="${dislikeText}: ${title}">${labelledIcon(disliked ? THUMB_DOWN_FILLED : THUMB_DOWN, dislikeText)}</a>
        </span>
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

export const paintWish = (card, on) => paintControl(card, '[data-wish]', on, on ? HEART_FILLED : HEART, wishlistLabel(on));
export const paintLike = (card, on) => paintControl(card, '[data-like]', on, on ? THUMB_UP_FILLED : THUMB_UP, likeLabel(on));

/** Dislike: the album is dimmed. A disliked album is not a liked one (the wishlist is not touched). */
export function paintDislike(card, on) {
  card.classList.toggle('is-disliked', on);
  paintControl(card, '[data-dislike]', on, on ? THUMB_DOWN_FILLED : THUMB_DOWN, dislikeLabel(on));
  if (on) paintLike(card, false);
}
