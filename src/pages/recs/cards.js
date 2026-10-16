// Album card markup and the in-place updates of its wishlist / dislike controls.
import { esc, safeUrl } from './dom.js';
import { ADD_CIRCLE, BLOCK, CHECK_CIRCLE, HEART, HEART_FILLED, decorativeIcon, dislikeLabel, labelledIcon, saveLabel, wishlistLabel } from './icons.js';

/**
 * `album`: a candidate from the state pool. `flags`: { wished (in the wishlist), saved (the song of the card is in Liked Songs), disliked }.
 * A card is for one song, the one the radio plays from that album: its title, the artist and the album under it. The heart and the +
 * are for that song. An album whose song is not known yet (a list made by an older version) shows the album as before.
 */
export function cardHtml(album, { wished = false, saved = false, disliked }) {
  const url = esc(safeUrl(album.url));
  const albumTitle = esc(album.title);
  const song = album.song && album.song.title ? album.song : null;
  const title = esc(song ? song.title : album.title);
  const wishlistText = wishlistLabel(wished);
  const saveText = saveLabel(saved, Boolean(song));
  const dislikeText = dislikeLabel(disliked);
  return `<article class="album-card${disliked ? ' is-disliked' : ''}" data-id="${album.id}" data-title="${title}" data-album="${albumTitle}">
    <div class="album-cover">
      <a href="${url}" target="_blank" rel="noopener" data-open><img src="${esc(safeUrl(album.art))}" alt="Cover of ${albumTitle} by ${esc(album.artist)}" loading="lazy"></a>
      <button type="button" class="cover-play" data-play title="Play here" aria-label="Play ${title} by ${esc(album.artist)}">▶</button>
      <span class="cover-badge" title="This album won't be shown again" aria-hidden="true">${decorativeIcon(BLOCK)}</span>
    </div>
    <div class="album-body">
      <a class="album-title" href="${url}" target="_blank" rel="noopener" data-open>${title}</a>
      <a class="album-artist" href="${url}" target="_blank" rel="noopener" data-open>${esc(album.artist)}</a>
      ${song ? `<a class="album-album" href="${url}" target="_blank" rel="noopener" data-open>${albumTitle}</a>` : ''}
      <div class="album-actions">
        <a href="#" class="dr-act dr-act--wish action-wishlist${wished ? ' is-on' : ''}" data-wish title="${wishlistText}" aria-label="${wishlistText}: ${title}">${labelledIcon(wished ? HEART_FILLED : HEART, wishlistText)}</a>
        <a href="#" class="dr-act dr-act--save action-save${saved ? ' is-on' : ''}" data-save title="${saveText}" aria-label="${saveText}: ${title}">${labelledIcon(saved ? CHECK_CIRCLE : ADD_CIRCLE, saveText)}</a>
        <a href="#" class="dr-act dr-act--dislike action-dislike${disliked ? ' is-on' : ''}" data-dislike title="${dislikeText}" aria-label="${dislikeText}: ${albumTitle}">${labelledIcon(BLOCK, dislikeText)}</a>
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

export const paintSave = (card, on) => paintControl(card, '[data-save]', on, on ? CHECK_CIRCLE : ADD_CIRCLE, saveLabel(on, card.querySelector('.album-album') !== null));
export const paintWish = (card, on) => paintControl(card, '[data-wish]', on, on ? HEART_FILLED : HEART, wishlistLabel(on));

/** Dislike: the album is dimmed (the wishlist is not touched). */
export function paintDislike(card, on) {
  card.classList.toggle('is-disliked', on);
  paintControl(card, '[data-dislike]', on, BLOCK, dislikeLabel(on));
}
