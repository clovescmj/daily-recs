// Entry point of the recommendations page. Everything is wired here, in a fixed order.
import { reportBugUrl, supportUrl } from '../../lib/config.js';
import { MSG } from '../../lib/messages.js';
import { runCommand } from './commands.js';
import { loadState, loadStatus, send, watchStorage } from './data.js';
import { $ } from './dom.js';
import { listenToHost } from './host-bridge.js';
import { initPlayer, playAlbum, togglePlay } from './player.js';
import { currentList, render } from './render.js';
import { session } from './session.js';
import { dislikeAlbum, setLike, undoDislike } from './wishlist-actions.js';

/** Switches to the surprise list the moment a run that was started with "Surprise me" has produced it. */
function resolvePendingSurprise(state, status) {
  const pending = session.pendingSurprise;
  if (!pending) return;
  if (status.running) { pending.sawRunning = true; return; }
  if (currentList(state, 'surprise') !== currentList(state, 'best')) { // the surprise list exists now
    session.view = 'surprise';
    session.pendingSurprise = null;
  } else if (pending.sawRunning) {
    session.pendingSurprise = null; // the run ended without a list (error): the status box explains why
  }
}

async function refreshView() {
  const [state, status] = [await loadState(), (await loadStatus()) || {}];
  resolvePendingSurprise(state, status);
  render(state, status);
}

async function onModeToggle() {
  if (session.view === 'surprise') { session.view = 'best'; await refreshView(); return; }
  const state = await loadState();
  if (currentList(state, 'surprise') !== currentList(state, 'best')) { // already built today: just show it
    session.view = 'surprise';
    await refreshView();
    return;
  }
  session.pendingSurprise = { sawRunning: false };
  await send({ type: MSG.REFRESH, mode: 'surprise' });
  scrollToTop();
}

const scrollToTop = () => $('album-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });

function onGridClick(event) {
  const card = event.target.closest('.album-card');
  if (!card) return;
  const { id } = card.dataset;
  if (event.target.closest('[data-play]')) {
    playAlbum(id);
  } else if (event.target.closest('[data-like]')) {
    event.preventDefault();
    setLike(id, !session.liked.has(id));
  } else if (event.target.closest('[data-dislike]')) {
    event.preventDefault();
    if (session.dislikedThisVisit.has(id)) undoDislike(id); else dislikeAlbum(id);
  } else if (event.target.closest('[data-open]')) {
    send({ type: MSG.MARK_OPENED, id });
  }
}

/** This page only works inside the Bandcamp profile (the player bar and wishlist live there): if it was opened on its own, go there. */
async function leaveToProfile() {
  document.body.textContent = 'Opening your Bandcamp profile…';
  await send({ type: MSG.OPEN_MAIN });
  chrome.tabs.getCurrent((tab) => { if (tab) chrome.tabs.remove(tab.id); });
}

async function init() {
  if (window.parent === window) { leaveToProfile(); return; }
  document.title = 'Daily Recs';
  $('version').textContent = chrome.runtime.getManifest().version;
  $('feedback-link').href = supportUrl(chrome.runtime.id);
  $('bug-link').href = reportBugUrl(chrome.runtime.getManifest().version, navigator.userAgent);

  $('mode-toggle').addEventListener('click', onModeToggle);
  $('play-all').addEventListener('click', () => togglePlay());
  $('album-grid').addEventListener('click', onGridClick);

  initPlayer();
  listenToHost(runCommand);

  watchStorage(refreshView);
  await refreshView();
  send({ type: MSG.REFRESH }); // builds today's list if it doesn't exist yet
}

init();
