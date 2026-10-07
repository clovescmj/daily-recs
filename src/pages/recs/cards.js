// Album card markup and the in-place updates of its like/dislike controls.
import { esc, safeUrl } from './dom.js';
import { ADD_CIRCLE, BLOCK, HEART, HEART_FILLED, decorativeIcon, dislikeLabel, labelledIcon, wishlistLabel } from './icons.js';

/** `album`: a candidate from the state pool. `flags`: { liked, disliked }. */
export function cardHtml(album, { liked, disliked }) {
  const url = esc(safeUrl(album.url));
  const title = esc(album.title);
  const reason = album.via ? `People who own “${esc(album.via)}” also own` : '';
  const fans = album.fans ? ` · ${album.fans} fans in common` : '';
  const wishlistText = wishlistLabel(liked);
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
        <a href="#" class="action-wishlist${liked ? ' is-on' : ''}" data-like title="${wishlistText}" aria-label="${wishlistText}: ${title}">${labelledIcon(liked ? HEART_FILLED : HEART, wishlistText)}</a>
        <a href="#" class="action-dislike${disliked ? ' is-on' : ''}" data-dislike title="${dislikeText}" aria-label="${dislikeText}: ${title}">${labelledIcon(disliked ? ADD_CIRCLE : BLOCK, dislikeText)}</a>
        <span class="action-sep">·</span><a href="${url}" target="_blank" rel="noopener" data-open aria-label="Go to album ${title} on Bandcamp">go to album</a>
      </div>
    </div>
  </article>`;
}

export const findCard = (id) => document.querySelector(`.album-card[data-id="${id}"]`);
export const visibleCardIds = () => [...document.querySelectorAll('.album-card:not(.is-disliked)')].map((card) => card.dataset.id);

export function paintLike(card, on) {
  const link = card.querySelector('[data-like]');
  link.classList.toggle('is-on', on);
  link.querySelector('path').setAttribute('d', on ? HEART_FILLED : HEART);
  const label = wishlistLabel(on);
  link.title = label;
  link.setAttribute('aria-label', `${label}: ${card.dataset.title}`);
  link.querySelector('title').textContent = label;
}

export function paintDislike(card, on) {
  card.classList.toggle('is-disliked', on);
  const label = dislikeLabel(on);
  const link = card.querySelector('[data-dislike]');
  link.classList.toggle('is-on', on);
  link.title = label;
  link.setAttribute('aria-label', `${label}: ${card.dataset.title}`);
  link.querySelector('title').textContent = label;
  link.querySelector('path').setAttribute('d', on ? ADD_CIRCLE : BLOCK);
  if (on) paintLike(card, false);
}
