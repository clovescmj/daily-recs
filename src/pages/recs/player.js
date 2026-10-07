// Audio playback. This page (an iframe inside the Bandcamp profile) owns the <audio> element; the Bandcamp-style bar
// (src/player, drawn by the content script in the Bandcamp page) only shows state and sends commands back.
import { parseTracks } from '../../lib/bandcamp.js';
import { findCard, visibleCardIds } from './cards.js';
import { loadState, send } from './data.js';
import { session } from './session.js';
import { postToHost } from './host-bridge.js';
import { MSG } from '../../lib/messages.js';

const TRACKS_TTL_MS = 20 * 60 * 1000;      // stream URLs expire, so cached track lists only live a few minutes
const SHUFFLE_RECENT = 5;                   // don't shuffle back to one of the last N albums
const SHUFFLE_TRIES = 6;
const EMIT_MIN_INTERVAL_MS = 200;
const VOLUME_KEY = 'dr-vol';

const audio = new Audio();
audio.preload = 'none';

const player = {
  current: { id: null, tracks: [], index: 0 },
  album: null,          // candidate being played (for the bar and Media Session)
  shuffle: false,
  busy: false,          // loading tracks
  message: '',          // error text for the bar
  history: [],          // shuffle history, for "previous"
};
const trackCache = new Map();    // album id -> { tracks, at }
let lastEmit = 0;
let queueCache = { key: '', items: [] };
let queueSentKey = '';
let recoveredAt = null;          // guards the one-shot recovery from an expired stream URL

export const isPlaying = () => !audio.paused;
export const currentId = () => player.current.id;
export const currentAlbum = () => player.album;
export const isShuffling = () => player.shuffle;

// ── Tracks ──────────────────────────────────────────────────────────────────────────────────────────────────────

async function fetchTracks(album, { fresh = false } = {}) {
  const cached = trackCache.get(album.id);
  if (!fresh && cached && Date.now() - cached.at < TRACKS_TTL_MS) return cached.tracks;
  const response = await fetch(album.url, { credentials: 'include' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const tracks = parseTracks(await response.text());
  trackCache.set(album.id, { tracks, at: Date.now() });
  return tracks;
}

const poolAlbum = async (id) => ((await loadState()) || { pool: {} }).pool[id];

// ── Starting playback ───────────────────────────────────────────────────────────────────────────────────────────

function setAlbum(album) {
  player.album = album;
  emit(true);
}

function playTrack(index) {
  const { tracks } = player.current;
  player.current.index = index;
  player.busy = false;
  player.message = '';
  recoveredAt = null;
  audio.src = tracks[index].src;
  audio.play().catch(() => {});
  setMediaSession();
  markPlaying();
  emit(true);
}

export async function playAlbum(id) {
  if (player.current.id === id && audio.src) { togglePlay(); return; }
  setShuffle(false);
  const album = await poolAlbum(id);
  if (!album) return;
  setAlbum(album);
  player.busy = true;
  player.message = '';
  emit(true);
  try {
    const tracks = await fetchTracks(album);
    if (!tracks.length) throw new Error('no streamable tracks');
    player.current = { id, tracks, index: 0 };
    send({ type: MSG.MARK_OPENED, id });
    playTrack(0);
  } catch (error) {
    player.busy = false;
    player.message = `Couldn't play (${error.message}). Open it on Bandcamp.`;
    emit(true);
  }
}

async function playRandomTrack() {
  player.busy = true;
  player.message = '';
  emit(true);
  const state = await loadState();
  const recent = new Set(player.history.slice(-SHUFFLE_RECENT).map((h) => h.id));
  let candidates = visibleCardIds().filter((id) => !recent.has(id));
  if (!candidates.length) candidates = visibleCardIds();
  for (let tries = 0; tries < SHUFFLE_TRIES && candidates.length; tries++) {
    const id = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
    try {
      const album = state.pool[id];
      const tracks = await fetchTracks(album);
      if (!tracks.length) continue;
      const index = Math.floor(Math.random() * tracks.length);
      player.current = { id, tracks, index };
      player.history.push({ id, i: index });
      setAlbum(album);
      send({ type: MSG.MARK_OPENED, id });
      playTrack(index);
      return;
    } catch { /* try another album */ }
  }
  player.busy = false;
  player.message = 'None of these albums have streamable tracks.';
  emit(true);
}

// ── Transport ───────────────────────────────────────────────────────────────────────────────────────────────────

const nextAlbumId = () => { const ids = visibleCardIds(); return ids[ids.indexOf(player.current.id) + 1]; };
const startFirst = () => (player.shuffle ? playRandomTrack() : visibleCardIds()[0] && playAlbum(visibleCardIds()[0]));

export const togglePlay = () => {
  if (!player.current.id) return startFirst();
  return audio.paused ? audio.play().catch(() => {}) : audio.pause();
};
export const pause = () => audio.pause();

export function nextTrack() {
  if (!player.current.id) return startFirst();
  if (player.shuffle) return playRandomTrack();
  if (player.current.index + 1 < player.current.tracks.length) return playTrack(player.current.index + 1);
  const next = nextAlbumId();
  return next && playAlbum(next);
}

export function skipAlbum() {
  if (!player.current.id) return startFirst();
  if (player.shuffle) return playRandomTrack();
  const next = nextAlbumId();
  return next && playAlbum(next);
}

export async function previousTrack() {
  if (!player.shuffle) {
    if (audio.currentTime > 3 || player.current.index === 0) { audio.currentTime = 0; return; }
    playTrack(player.current.index - 1);
    return;
  }
  if (audio.currentTime > 3 || player.history.length < 2) { audio.currentTime = 0; return; }
  player.history.pop();
  const last = player.history[player.history.length - 1];
  const album = await poolAlbum(last.id);
  player.current = { id: last.id, tracks: await fetchTracks(album), index: last.i };
  setAlbum(album);
  playTrack(last.i);
}

export const seekBy = (seconds) => {
  if (audio.duration) audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
};
export const seekTo = (fraction) => { if (audio.duration) audio.currentTime = fraction * audio.duration; };

export function setVolume(value) {
  audio.muted = false;
  audio.volume = Math.max(0, Math.min(1, value));
  try { localStorage.setItem(VOLUME_KEY, String(audio.volume)); } catch { /* storage unavailable */ }
}
export const toggleMute = () => { audio.muted = !audio.muted; };

function setShuffle(on) {
  player.shuffle = on;
  emit(true);
}

export function toggleShuffle() {
  if (player.shuffle) { setShuffle(false); return undefined; }
  setShuffle(true);
  if (!player.current.id) return playRandomTrack(); // nothing playing yet: shuffle starts with a random track
  // Something is playing (or paused): keep the current track and only shuffle from here on. It goes into the
  // history so "previous" can come back to it.
  if (!player.history.length) player.history.push({ id: player.current.id, i: player.current.index });
  emit(true);
  return undefined;
}

/** The album that was playing was removed from the list: move on. */
export function continueAfterRemoval(nextId) {
  if (player.shuffle) playRandomTrack();
  else if (nextId) playAlbum(nextId);
  else audio.pause();
}

// ── Media keys / system controls ────────────────────────────────────────────────────────────────────────────────

function setMediaSession() {
  if (!('mediaSession' in navigator) || !player.album) return;
  const track = player.current.tracks[player.current.index];
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title, artist: player.album.artist, album: player.album.title, artwork: [{ src: player.album.art }],
  });
}

function registerMediaSessionHandlers() {
  if (!('mediaSession' in navigator)) return;
  const handlers = {
    play: () => audio.play(), pause: () => audio.pause(), previoustrack: previousTrack, nexttrack: nextTrack,
    seekbackward: () => seekBy(-15), seekforward: () => seekBy(15),
  };
  for (const [action, handler] of Object.entries(handlers)) navigator.mediaSession.setActionHandler(action, handler);
}

// ── Highlighting the playing card ───────────────────────────────────────────────────────────────────────────────

/** The play button next to the page title mirrors the player: play / pause. */
function paintPlayAll() {
  const button = document.getElementById('play-all');
  if (!button) return;
  const playing = !audio.paused;
  button.classList.toggle('is-playing', playing);
  const label = playing ? 'Pause' : 'Play';
  button.title = label;
  button.setAttribute('aria-label', label);
}

export function markPlaying() {
  paintPlayAll();
  document.querySelectorAll('.album-card').forEach((card) => {
    const isCurrent = card.dataset.id === player.current.id;
    card.classList.toggle('is-playing', isCurrent);
    card.classList.toggle('is-audible', isCurrent && !audio.paused);
  });
}

// ── Bar state ───────────────────────────────────────────────────────────────────────────────────────────────────

function queueItems() {
  const ids = visibleCardIds();
  const key = ids.join(',');
  if (key !== queueCache.key) {
    queueCache = {
      key,
      items: ids.map((id) => {
        const card = findCard(id);
        return { id, label: `${card.querySelector('.album-artist').textContent} - ${card.querySelector('.album-title').textContent}` };
      }),
    };
  }
  return queueCache;
}

function snapshot() {
  const { current, album } = player;
  const track = current.tracks[current.index];
  const queue = queueItems();
  const albumIndex = visibleCardIds().indexOf(current.id);
  const snap = {
    has: session.hasList,
    art: album ? album.art : '', url: album ? album.url : '',
    albumTitle: album ? album.title : '', artist: album ? album.artist : '',
    trackNo: track ? current.index + 1 : 0, track: track ? track.title : '', msg: player.message,
    busy: player.busy || (!audio.paused && audio.readyState < 3),
    playing: !audio.paused, cur: audio.currentTime || 0, dur: audio.duration || 0,
    buf: audio.buffered.length ? audio.buffered.end(audio.buffered.length - 1) : 0,
    vol: audio.muted ? 0 : audio.volume, shuffle: player.shuffle,
    curId: current.id,
    liked: Boolean(album) && session.liked.has(album.id),
    disliked: Boolean(album) && session.dislikedThisVisit.has(album.id),
    hasPrev: player.shuffle ? player.history.length > 1 : current.index > 0,
    hasNext: player.shuffle || current.index + 1 < current.tracks.length || albumIndex + 1 < queue.items.length,
  };
  // The queue is large and rarely changes: it is only sent (to the other frame) when it did.
  if (queue.key !== queueSentKey) snap.queue = queue.items;
  return snap;
}

/** Pushes the current state to the bar. `force` skips the rate limit (used for discrete events, not timeupdate). */
export function emit(force = false) {
  const now = Date.now();
  if (!force && now - lastEmit < EMIT_MIN_INTERVAL_MS) return;
  lastEmit = now;
  const snap = snapshot();
  postToHost({ dr: 'now', ...snap });
  if (snap.queue) queueSentKey = queueCache.key;
}

// ── Audio events and setup ──────────────────────────────────────────────────────────────────────────────────────

/** Stream URLs expire. On an error, fetch fresh ones once and resume where we were. */
async function recoverFromAudioError() {
  const { id, index } = player.current;
  if (!id || recoveredAt === `${id}:${index}`) {
    player.message = "Couldn't play this track. Try the next one.";
    emit(true);
    return;
  }
  recoveredAt = `${id}:${index}`;
  const position = audio.currentTime;
  try {
    const tracks = await fetchTracks(player.album, { fresh: true });
    if (!tracks[index]) return;
    player.current.tracks = tracks;
    audio.src = tracks[index].src;
    audio.currentTime = position;
    await audio.play();
  } catch {
    player.message = "Couldn't play this track. Try the next one.";
    emit(true);
  }
}

export function initPlayer() {
  try {
    const saved = localStorage.getItem(VOLUME_KEY);
    if (saved !== null && Number.isFinite(+saved)) audio.volume = Math.max(0, Math.min(1, +saved));
  } catch { /* storage unavailable */ }
  registerMediaSessionHandlers();
  audio.addEventListener('ended', nextTrack);
  audio.addEventListener('error', recoverFromAudioError);
  audio.addEventListener('play', markPlaying);
  audio.addEventListener('pause', markPlaying);
  for (const type of ['play', 'pause', 'timeupdate', 'loadedmetadata', 'volumechange', 'waiting', 'playing', 'canplay', 'progress']) {
    audio.addEventListener(type, () => emit(type !== 'timeupdate' && type !== 'progress'));
  }
}
