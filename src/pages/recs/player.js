// Audio playback. This page (an iframe inside the Bandcamp profile) owns the <audio> element; the Bandcamp-style bar
// (src/player, drawn by the content script in the Bandcamp page) only shows state and sends commands back.
import { embeddedPlayerUrl, isBandcampUrl, parseEmbeddedTracks, parseTracks } from '../../lib/bandcamp.js';
import { findCard, visibleCardIds } from './cards.js';
import { loadState, send } from './data.js';
import { session } from './session.js';
import { postToHost } from './host-bridge.js';
import { MSG } from '../../lib/messages.js';

const TRACKS_TTL_MS = 20 * 60 * 1000;      // stream URLs expire, so cached track lists only live a few minutes
const EMIT_MIN_INTERVAL_MS = 200;
const VOLUME_KEY = 'dr-vol';
const MODE_KEY = 'dr-mode';

const audio = new Audio();
audio.preload = 'none';

const player = {
  current: { id: null, tracks: [], index: 0 },
  album: null,          // candidate being played (for the bar and Media Session)
  mode: 'one',          // 'one': a song per album (its featured track, or the first), in the order of the list; 'album': whole albums
  busy: false,          // loading tracks
  message: '',          // error text for the bar
};
const trackCache = new Map();    // album id -> { tracks, at }
let lastEmit = 0;
let queueCache = { key: '', items: [] };
let queueSentKey = '';
let savedCache = { key: '', items: [] };
let savedSentKey = '';
let recoveredAt = null;          // guards the one-shot recovery from an expired stream URL

export const isPlaying = () => !audio.paused;
export const currentId = () => player.current.id;
export const currentAlbum = () => player.album;

// ── Tracks ──────────────────────────────────────────────────────────────────────────────────────────────────────

async function fetchTracks(album, { fresh = false } = {}) {
  const cached = trackCache.get(album.id);
  if (!fresh && cached && Date.now() - cached.at < TRACKS_TTL_MS) return cached.tracks;
  // Albums on a label's own domain can't be read from here (CORS); Bandcamp's embedded player lists their tracks.
  const onBandcamp = isBandcampUrl(album.url);
  const response = await fetch(onBandcamp ? album.url : embeddedPlayerUrl(album.id), { credentials: 'include' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const tracks = (onBandcamp ? parseTracks : parseEmbeddedTracks)(await response.text());
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

export async function playAlbum(id, startIndex = null) {
  if (startIndex === null && player.current.id === id && audio.src) { togglePlay(); return; }
  const album = await poolAlbum(id);
  if (!album) return;
  setAlbum(album);
  player.busy = true;
  player.message = '';
  emit(true);
  try {
    const tracks = await fetchTracks(album);
    if (!tracks.length) throw new Error('no streamable tracks');
    const first = startIndex !== null && startIndex < tracks.length ? startIndex : startingTrack(tracks);
    player.current = { id, tracks, index: first };
    send({ type: MSG.MARK_OPENED, id });
    playTrack(first);
  } catch (error) {
    player.busy = false;
    player.message = `Couldn't play (${error.message}). Open it on Bandcamp.`;
    emit(true);
  }
}

/** The songs of an album, as the Liked list keeps them (up to MAX_ALBUM_SONGS). */
const MAX_ALBUM_SONGS = 60;
export async function albumSongs(id) {
  const album = await poolAlbum(id);
  if (!album) return [];
  const tracks = await fetchTracks(album);
  return tracks.slice(0, MAX_ALBUM_SONGS).map((track, i) => ({ id, i, title: track.title }));
}

/** A track of the Liked list: its album, starting at that track (or at the same number if the track list changed). */
export const playSavedTrack = (id, index) => playAlbum(id, index);

/** The track that is playing, as the Liked list keeps it. */
export function currentTrack() {
  const { current, album } = player;
  const track = current.tracks[current.index];
  return album && track ? { id: album.id, i: current.index, title: track.title } : null;
}

/** Where an album starts: the track the artist highlights on Bandcamp, or the first one when none is set. */
const startingTrack = (tracks) => Math.max(0, tracks.findIndex((track) => track.featured));

// ── Transport ───────────────────────────────────────────────────────────────────────────────────────────────────

const nextAlbumId = () => { const ids = visibleCardIds(); return ids[ids.indexOf(player.current.id) + 1]; };
const startFirst = () => visibleCardIds()[0] && playAlbum(visibleCardIds()[0]);

export const togglePlay = () => {
  if (!player.current.id) return startFirst();
  return audio.paused ? audio.play().catch(() => {}) : audio.pause();
};
export const pause = () => audio.pause();

export function nextTrack() {
  if (!player.current.id) return startFirst();
  if (player.mode === 'one') return skipAlbum(); // a song per album: the next one is the next album's
  if (player.current.index + 1 < player.current.tracks.length) return playTrack(player.current.index + 1);
  const next = nextAlbumId();
  return next && playAlbum(next);
}

function skipAlbum() {
  if (!player.current.id) return startFirst();
  const next = nextAlbumId();
  return next && playAlbum(next);
}

export async function previousTrack() {
  if (player.mode === 'one') { // back to the previous album's song (or to the start of this one, when it has been playing a while)
    const ids = visibleCardIds();
    const before = ids[ids.indexOf(player.current.id) - 1];
    if (audio.currentTime > 3 || !before) { audio.currentTime = 0; return; }
    playAlbum(before);
    return;
  }
  if (audio.currentTime > 3 || player.current.index === 0) { audio.currentTime = 0; return; }
  playTrack(player.current.index - 1);
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

/** 'one' (a song per album, the way Bandcamp's own lists play) or 'album'. */
export function setMode(mode) {
  if (mode !== 'one' && mode !== 'album') return;
  player.mode = mode;
  try { localStorage.setItem(MODE_KEY, player.mode); } catch { /* storage unavailable */ }
  emit(true);
}

/** The album that was playing was removed from the list: move on. */
export function continueAfterRemoval(nextId) {
  if (nextId) playAlbum(nextId);
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

/** True when a song of the album is in Liked Songs. */
const hasSavedSong = (id) => [...session.saved].some((key) => key.startsWith(`${id}:`));

function queueItems() {
  const ids = visibleCardIds();
  // the heart of each item is part of the key, so the bar redraws when one of them changes
  const key = ids.map((id) => `${id}${session.wished.has(id) ? 'w' : ''}${hasSavedSong(id) ? 's' : ''}`).join(',');
  if (key !== queueCache.key) {
    queueCache = {
      key,
      items: ids.map((id) => {
        const card = findCard(id);
        return {
          id, label: `${card.querySelector('.album-artist').textContent} - ${card.querySelector('.album-title').textContent}`,
          wished: session.wished.has(id), saved: hasSavedSong(id),
        };
      }),
    };
  }
  return queueCache;
}

/** The Liked list, the most recent first: tracks, with the album each one is from (they stay until taken out). */
function savedItems() {
  const state = session.state || {};
  const entries = [...(state.saved || [])].reverse().filter((entry) => session.saved.has(`${entry.id}:${entry.i}`) && state.pool && state.pool[entry.id]);
  const key = entries.map((entry) => `${entry.id}:${entry.i}${session.wished.has(entry.id) ? 'w' : ''}`).join(',');
  if (key !== savedCache.key) {
    savedCache = {
      key,
      items: entries.map((entry) => ({
        id: entry.id, i: entry.i, title: entry.title, label: `${entry.title || `Track ${entry.i + 1}`} · ${state.pool[entry.id].artist}`, wished: session.wished.has(entry.id),
      })),
    };
  }
  return savedCache;
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
    vol: audio.muted ? 0 : audio.volume,
    curId: current.id,
    wished: Boolean(album) && session.wished.has(album.id),
    isSaved: Boolean(album && track) && session.saved.has(`${album.id}:${current.index}`),
    disliked: Boolean(album) && session.dislikedThisVisit.has(album.id),
    mode: player.mode,
    hasPrev: player.mode === 'one' ? albumIndex > 0 : current.index > 0,
    hasNext: player.mode === 'one' ? albumIndex + 1 < queue.items.length : current.index + 1 < current.tracks.length || albumIndex + 1 < queue.items.length,
  };
  // The queue is large and rarely changes: it is only sent (to the other frame) when it did.
  if (queue.key !== queueSentKey) snap.queue = queue.items;
  const saved = savedItems();
  if (saved.key !== savedSentKey) snap.savedList = saved.items;
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
  if (snap.savedList) savedSentKey = savedCache.key;
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
    player.mode = localStorage.getItem(MODE_KEY) === 'album' ? 'album' : 'one';
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
