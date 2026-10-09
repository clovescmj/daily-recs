// The progress box shown while a run is working, and the sign-in / error messages.
import { $, esc, formatNumber, formatTime } from './dom.js';
import { MSG } from '../../lib/messages.js';
import { send } from './data.js';
import { PHASE } from '../../lib/recommender.js';
import { scanProgress } from '../../lib/taste-profile.js';
import { session } from './session.js';
import { DAILY_COUNT } from '../../lib/state.js';
import { onWaitingChange, waiting } from './waiting.js';

const SAMPLING_PHASES = new Set([PHASE.SAMPLING]);

/**
 * What the loading box says: a title (what is being done) and, only when there is something worth saying,
 * a detail line (how far it is). `detail` is empty otherwise, and the box shows no second line.
 */
export function progressParts(status) {
  const surprise = status.mode === 'surprise';
  const genres = (status.tagLabels || []).join(' + ');
  const albums = status.total ? `${formatNumber(status.done)} of ${formatNumber(status.total)} albums` : '';
  if (status.mode === 'tags' && status.phase === PHASE.SCANNING) return { title: `Finding your ${genres} albums`, detail: albums };
  if (status.mode === 'tags' && SAMPLING_PHASES.has(status.phase)) return { title: `Digging into ${genres}`, detail: albums };
  if (SAMPLING_PHASES.has(status.phase)) {
    if (status.bootstrap) return { title: 'Learning your taste', detail: 'First time only, takes a few minutes' };
    return { title: surprise ? 'Digging for surprises' : 'Sampling your collection', detail: albums };
  }
  switch (status.phase) {
    case PHASE.SIGNING_IN: return { title: 'Signing in', detail: '' };
    case PHASE.LIBRARY: return { title: 'Reading your library', detail: '' };
    case PHASE.TASTE: return { title: 'Checking tags', detail: albums };
    case PHASE.RANKING: return { title: 'Ranking candidates', detail: status.candidates ? `${formatNumber(status.candidates)} found` : '' };
    case PHASE.PICKING: return { title: `Choosing your ${DAILY_COUNT}`, detail: '' };
    default: return { title: 'Working', detail: '' };
  }
}

/** Five bars that dance (an equalizer): CSS does the dancing, and stops it for people who asked for less motion. */
const EQUALIZER = '<span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';

// Material's play_arrow and pause
const WAIT_PLAY = '<svg class="wait-play" viewBox="0 -960 960 960" aria-hidden="true"><path d="M320-200v-560l440 280-440 280Z"/></svg>';
const WAIT_PAUSE = '<svg class="wait-pause" viewBox="0 -960 960 960" aria-hidden="true"><path d="M520-200v-560h240v560H520Zm-320 0v-560h240v560H200Z"/></svg>';
const WAIT_IDLE = 'Play a song while waiting';

/** The right side of the loading box: a song of the collection to listen to while the list is built. */
function paintWait(info = waiting.info()) {
  const box = $('status');
  const wait = box && box.querySelector('.loading-wait');
  if (!wait) return;
  wait.hidden = !waiting.can();
  const label = wait.querySelector('.wait-label');
  const textEl = label.firstElementChild;
  const text = info.playing ? `${info.artist ? `${info.artist} - ` : ''}${info.song}` : WAIT_IDLE;
  if (textEl.textContent !== text) { // the same fade as the title of the steps
    textEl.textContent = text;
    label.classList.remove('is-new'); void label.offsetWidth; label.classList.add('is-new');
  }
  scrollIfLong(label);
  const button = wait.querySelector('.wait-btn');
  const action = info.playing ? `Pause: ${text}` : 'Play a song from your collection while waiting';
  button.classList.toggle('is-playing', info.playing);
  button.setAttribute('aria-label', action);
  button.title = action;
}
/** A name wider than the button scrolls inside it (to the end and back); one that fits stays still. */
function scrollIfLong(label) {
  const textEl = label.firstElementChild;
  label.classList.remove('is-run');
  const over = textEl.scrollWidth - label.clientWidth;
  if (over > 2) {
    label.style.setProperty('--wait-x', `${-(over + 16)}px`);
    label.style.setProperty('--wait-dur', `${Math.max(6, (over + 16) / 18)}s`); // about 18 px a second
    label.classList.add('is-run');
  }
}
onWaitingChange(paintWait);

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

/**
 * The loading box is built once and then only updated, so the second line can slide in and out and the bar can grow.
 * The title fades in when it changes; the detail keeps its last text while it collapses.
 */
function paintLoading(box, { title, detail }, progress) {
  if (!box.querySelector('.loading')) {
    box.innerHTML = `<div class="loading" role="status">${EQUALIZER}<div class="loading-text"><strong></strong><div class="loading-sub"><span></span></div></div><div class="loading-wait" hidden><button type="button" class="wait-btn">${WAIT_PLAY}${WAIT_PAUSE}<span class="wait-label"><span class="wait-text"></span></span></button></div></div><progress></progress>`;
    box.querySelector('.wait-btn').addEventListener('click', () => waiting.toggle());
  }
  const strong = box.querySelector('.loading-text strong');
  if (strong.textContent !== title) {
    strong.textContent = title;
    strong.classList.remove('is-new'); void strong.offsetWidth; strong.classList.add('is-new');
  }
  const sub = box.querySelector('.loading-sub');
  if (detail) box.querySelector('.loading-sub span').textContent = detail;
  sub.classList.toggle('is-on', !!detail);
  const bar = box.querySelector('progress');
  if (progress) { bar.max = Number(progress.total); bar.value = Number(progress.done) || 0; } else { bar.removeAttribute('max'); bar.removeAttribute('value'); }
}

/** Draws the box for the given status. "Load more" shows its own spinner instead of a box. */
export function renderStatus(status) {
  const box = $('status');
  session.running = Boolean(status.running);
  box.classList.remove('is-loading');
  if (!(status.error === 'rate_limited' && status.retryAt)) clearInterval(countdownTimer);
  if (status.running) {
    // On the opening screen the day's list is built in the background: nothing to show until the user picks something.
    if (session.landing) { box.hidden = true; return; }
    const determinate = (status.phase === PHASE.SAMPLING || status.phase === PHASE.TASTE) && status.total;
    box.hidden = false;
    box.classList.add('is-loading');
    paintLoading(box, progressParts(status), determinate ? status : null);
    paintWait();
  } else if (status.error === 'not_logged_in') {
    box.hidden = false;
    box.innerHTML = `<strong>You're not signed in to Bandcamp.</strong><p>Sign in to your account and come back here.</p>
      <button type="button" id="login" class="button">Sign in to Bandcamp</button>`;
    $('login').addEventListener('click', () => send({ type: MSG.OPEN_MAIN }));
  } else if (status.error === 'no_seeds') {
    const { scanned, total } = session.state ? scanProgress(session.state) : { scanned: 0, total: 0 };
    box.hidden = false;
    box.innerHTML = `<strong>None of your albums has ${esc((status.tagLabels || []).join(' + ') || 'this tag')} yet.</strong>
      <p>${total ? `${formatNumber(scanned)} of ${formatNumber(total)} albums scanned so far. The scan keeps going in the background: try again later, or pick another tag.` : 'Pick another tag.'}</p>`;
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
