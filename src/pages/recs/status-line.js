// The progress box shown while a run is working, and the sign-in / error messages.
import { $, esc, formatNumber, formatTime } from './dom.js';
import { MSG } from '../../lib/messages.js';
import { send } from './data.js';
import { PHASE } from '../../lib/recommender.js';
import { scanProgress } from '../../lib/taste-profile.js';
import { session } from './session.js';
import { DAILY_COUNT } from '../../lib/state.js';

const SAMPLING_PHASES = new Set([PHASE.SAMPLING]);

export function progressText(status) {
  const surprise = status.mode === 'surprise';
  const genres = (status.tagLabels || []).join(' + ');
  if (status.mode === 'tags') {
    const count = `${formatNumber(status.done)}/${formatNumber(status.total)}`;
    if (status.phase === PHASE.SCANNING) return `Looking for your ${genres} albums · ${count}`;
    if (SAMPLING_PHASES.has(status.phase)) return `Digging into your ${genres} albums · ${count}`;
  }
  if (SAMPLING_PHASES.has(status.phase)) {
    if (status.bootstrap) return `Learning your taste, first time only (takes a few minutes) · ${formatNumber(status.done)}/${formatNumber(status.total)}`;
    const liked = status.likedPicked ? ` (${status.likedPicked} you liked)` : '';
    const what = `${formatNumber(status.picked)} ${status.library ? `of your ${formatNumber(status.library)} albums` : 'random albums'}${liked}`;
    return `${surprise ? 'Digging for surprises in' : 'Picking and analyzing'} ${what} · ${formatNumber(status.done)}/${formatNumber(status.total)}`;
  }
  switch (status.phase) {
    case PHASE.SIGNING_IN: return 'Signing in to Bandcamp…';
    case PHASE.LIBRARY: return 'Reading your collection and wishlist…';
    case PHASE.TASTE: return `Checking ${formatNumber(status.done)}/${formatNumber(status.total)} candidates against your taste…`;
    case PHASE.RANKING: return `Ranking ${formatNumber(status.candidates)} candidates…`;
    case PHASE.PICKING: return surprise ? 'Digging below the obvious picks…' : `Picking your ${DAILY_COUNT}…`;
    default: return 'Working…';
  }
}

/**
 * The same progress, split for the loading box: a title (what is being done), a detail line and a counter.
 * `count` is empty while there is nothing to count.
 */
export function progressParts(status) {
  const surprise = status.mode === 'surprise';
  const genres = (status.tagLabels || []).join(' + ');
  const count = status.total ? `${formatNumber(status.done)} / ${formatNumber(status.total)}` : '';
  if (status.mode === 'tags' && status.phase === PHASE.SCANNING) return { title: `Looking for your ${genres} albums…`, detail: 'Reading more of your albums to find them', count };
  if (status.mode === 'tags' && SAMPLING_PHASES.has(status.phase)) return { title: `Digging into your ${genres} albums…`, detail: 'Reading what fans of them also own', count };
  if (SAMPLING_PHASES.has(status.phase)) {
    if (status.bootstrap) return { title: 'Learning your taste…', detail: 'First time only: it takes a few minutes', count };
    const what = `${formatNumber(status.picked)} ${status.library ? `of your ${formatNumber(status.library)} albums` : 'random albums'}`;
    return { title: surprise ? 'Digging for surprises…' : 'Digging through your collection…', detail: `Reading ${what}`, count };
  }
  switch (status.phase) {
    case PHASE.SIGNING_IN: return { title: 'Signing in to Bandcamp…', detail: '', count };
    case PHASE.LIBRARY: return { title: 'Reading your collection and wishlist…', detail: '', count };
    case PHASE.TASTE: return { title: 'Checking the candidates against your taste…', detail: 'Looking at the genres of each one', count };
    case PHASE.RANKING: return { title: 'Ranking the candidates…', detail: `${formatNumber(status.candidates)} found`, count };
    case PHASE.PICKING: return { title: surprise ? 'Digging below the obvious picks…' : `Picking your ${DAILY_COUNT}…`, detail: '', count };
    default: return { title: 'Working…', detail: '', count };
  }
}

/** Five bars that dance (an equalizer): CSS does the dancing, and stops it for people who asked for less motion. */
const EQUALIZER = '<span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';

let countdownTimer = null;

/** Counts down to `retryAt`, then says it is trying again (the service worker restarts the run by itself). */
function startCountdown(retryAt) {
  const tick = () => {
    const el = $('retry-countdown');
    if (!el) { clearInterval(countdownTimer); return; }
    const seconds = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
    el.textContent = seconds ? `Trying again in ${formatTime(seconds)}.` : 'Trying again…';
    if (!seconds) clearInterval(countdownTimer);
  };
  clearInterval(countdownTimer);
  tick();
  countdownTimer = setInterval(tick, 1000);
}

/** Draws the box for the given status. "Load more" shows its own spinner instead of a box. */
export function renderStatus(status) {
  const box = $('status');
  box.classList.remove('is-loading');
  if (!(status.error === 'rate_limited' && status.retryAt)) clearInterval(countdownTimer);
  if (status.running) {
    // On the opening screen the day's list is built in the background: nothing to show until the user picks something.
    if (session.landing) { box.hidden = true; return; }
    const determinate = (status.phase === PHASE.SAMPLING || status.phase === PHASE.TASTE) && status.total;
    box.hidden = false;
    const { title, detail, count } = progressParts(status);
    box.classList.add('is-loading');
    box.innerHTML = `<div class="loading" role="status">${EQUALIZER}<div class="loading-text"><strong>${esc(title)}</strong>${detail ? `<span>${esc(detail)}</span>` : ''}</div>${count ? `<span class="loading-count">${esc(count)}</span>` : ''}</div>`
      + (determinate ? `<progress max="${Number(status.total)}" value="${Number(status.done) || 0}"></progress>` : '<progress></progress>');
  } else if (status.error === 'not_logged_in') {
    box.hidden = false;
    box.innerHTML = `<strong>You're not signed in to Bandcamp.</strong><p>Sign in to your account and come back here.</p>
      <button type="button" id="login" class="button">Sign in to Bandcamp</button>`;
    $('login').addEventListener('click', () => send({ type: MSG.OPEN_MAIN }));
  } else if (status.error === 'no_seeds') {
    const { scanned, total } = session.state ? scanProgress(session.state) : { scanned: 0, total: 0 };
    box.hidden = false;
    box.innerHTML = `<strong>None of your albums has ${esc((status.tagLabels || []).join(' + ') || 'this genre')} yet.</strong>
      <p>${total ? `${formatNumber(scanned)} of ${formatNumber(total)} albums scanned so far. The scan keeps going in the background: try again later, or pick another genre.` : 'Pick another genre.'}</p>`;
  } else if (status.error === 'rate_limited') {
    box.hidden = false;
    box.innerHTML = `<strong>Bandcamp asked us to slow down.</strong><p id="retry-countdown">${status.retryAt ? '' : 'Try again in a few minutes.'}</p>`;
    if (status.retryAt) startCountdown(status.retryAt);
  } else if (status.error) {
    box.hidden = false;
    box.innerHTML = `<strong>Something went wrong.</strong><p>${esc(status.error)}</p>`;
  } else {
    box.hidden = true;
  }
}
