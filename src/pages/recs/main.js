// Entry point of the recommendations page. Everything is wired here, in a fixed order.
import { reportBugUrl, supportUrl } from '../../lib/config.js';
import { MSG } from '../../lib/messages.js';
import { runCommand } from './commands.js';
import { loadState, loadStatus, pickedToday, savePicked, send, watchStorage } from './data.js';
import { $ } from './dom.js';
import { listenToHost } from './host-bridge.js';
import { initPlayer, playAlbum, togglePlay } from './player.js';
import { listFor, render } from './render.js';
import { session } from './session.js';
import { initLanding, refreshLanding, setLandingVisible } from './landing.js';
import { initViewSwitch } from './views.js';
import { dislikeAlbum, setLike, setWish, undoDislike } from './wishlist-actions.js';

/** Switches to a list the moment the run that was asked for has produced it. */
function resolvePending(state, status) {
  const pending = session.pending;
  if (!pending) return;
  if (status.running) { pending.sawRunning = true; return; }
  if (listFor(state, pending.view, pending.keys)) {
    session.view = pending.view;
    session.tagKeys = pending.keys;
    session.pending = null;
  } else if (pending.sawRunning) {
    session.pending = null; // the run ended without a list (an error, or no album of that genre): the status box says why
  }
}

async function refreshView() {
  const [state, status] = [await loadState(), (await loadStatus()) || {}];
  resolvePending(state, status);
  render(state, status);
  refreshLanding();
}

/** The user picked a list: show it if it exists today, otherwise ask for it and switch when it is ready. */
async function chooseView(view, keys = []) {
  await savePicked(view, keys);   // reopening the tab today brings this list back
  const state = await loadState();
  if (listFor(state, view, keys)) {
    session.view = view;
    session.tagKeys = keys;
    await refreshView();
    return;
  }
  session.pending = { view, keys, sawRunning: false };
  await refreshView();   // the toggle already shows the new choice
  await send({ type: MSG.REFRESH, mode: view, tags: keys });
  scrollToTop();
}

/** "Start digging" on the opening screen: remember the choice for today and show the list. */
async function startFromLanding(view, keys) {
  session.pending = { view, keys, sawRunning: false };   // the toggle shows the choice right away, before the list is ready
  setLandingVisible(false);
  await refreshView();   // a run that is already going on now shows its progress
  await chooseView(view, keys);
}

const scrollToTop = () => $('album-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });

function onGridClick(event) {
  const card = event.target.closest('.album-card');
  if (!card) return;
  const { id } = card.dataset;
  if (event.target.closest('[data-play]')) {
    playAlbum(id);
  } else if (event.target.closest('[data-wish]')) {
    event.preventDefault();
    setWish(id, !session.wished.has(id));
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

  initViewSwitch(chooseView);
  initLanding(startFromLanding);
  $('play-all').addEventListener('click', () => togglePlay());
  $('album-grid').addEventListener('click', onGridClick);

  initPlayer();
  listenToHost(runCommand);

  const picked = await pickedToday();
  setLandingVisible(!picked);   // once a day: the first time the tab is opened. Nothing is loaded until the user presses the button
  watchStorage(refreshView);
  await refreshView();
  if (picked) await chooseView(picked.view, picked.tags);   // already chose today: show that list (build it if it's missing)
}

init();
