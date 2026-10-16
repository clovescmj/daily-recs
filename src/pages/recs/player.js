// Audio playback. This page (an iframe inside the Bandcamp profile) owns the <audio> element; the Bandcamp-style bar
// (src/player, drawn by the content script in the Bandcamp page) only shows state and sends commands back.
import { embeddedPlayerUrl, isBandcampUrl, parseEmbeddedTracks, parseTracks, toMediaUrl } from '../../lib/bandcamp.js';
import { findCard, visibleCardIds } from './cards.js';
import { loadState, send } from './data.js';
import { session } from './session.js';
import { postToHost } from './host-bridge.js';
import { toast } from './toast.js';
import { MSG } from '../../lib/messages.js';
import { playbackQueue, startingTrack } from '../../lib/queue-rows.js';
import { waiting } from './waiting.js';

const TRACKS_TTL_MS = 20 * 60 * 1000;      // stream URLs expire, so cached track lists only live a few minutes
const EMIT_MIN_INTERVAL_MS = 200;
const VOLUME_KEY = 'dr-vol';

const audio = new Audio();
audio.preload = 'none';

const player = {
  current: { id: null, tracks: [], index: 0 },
  album: null,          // candidate being played (for the bar and Media Session)
  context: 'list',      // where playback goes on from: 'list' (the cards, in the order of the page) or 'liked' (a song was played from Liked Songs)
  cursor: null,         // the card of the list where it goes on from (the last card that played)
  busy: false,          // loading tracks
  message: '',          // error text for the bar
  waiting: false,       // a random song of the collection, played while a list is being built (it is not part of any list)
};
const history = [];              // the songs that played, in order: { id, index, title } (the previous button goes back along it)
const PLAYED_KEY = 'playedToday';   // chrome.storage.local: what played today, so a reload of the page or of the extension does not forget it (only today's counts)
const todayKey = () => { const d = new Date(); const pad = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
let saveTimer = null;
function writePlayed() {
  try { chrome.storage.local.set({ [PLAYED_KEY]: { date: todayKey(), history: history.slice(-500) } }); } catch { /* storage unavailable */ }
}
function savePlayed() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writePlayed, 300);
}
const PLAYED_AFTER_S = 2;           // a song that went on this long counts as played: its album is kept out of the next days' lists
const playedSent = new Set();
/** Tells the service worker, once per album, that one of its songs really played (not just a skip). */
function countAsPlayed() {
  const { current } = player;
  if (player.waiting || !/^\d+$/.test(String(current.id)) || playedSent.has(current.id) || audio.paused || audio.currentTime < PLAYED_AFTER_S) return;
  playedSent.add(current.id);
  send({ type: MSG.MARK_PLAYED, id: current.id });
}
const NOW_KEY = 'nowPlaying';       // the song that plays and where it is, in chrome.storage.local too
let lastNowSave = 0;
/** Keeps the song and the position (every few seconds while it plays, at once on a pause or a new song). A song of the loading box is not kept. */
function saveNowPlaying(force = false) {
  const { current } = player;
  if (player.waiting || !current.id || String(current.id).startsWith('w:') || !current.tracks[current.index]) return;
  const now = Date.now();
  if (!force && now - lastNowSave < 3000) return;
  lastNowSave = now;
  try { chrome.storage.local.set({ [NOW_KEY]: { date: todayKey(), id: current.id, index: current.index, time: audio.currentTime || 0 } }); } catch { /* storage unavailable */ }
}

/** After a reload: the bar shows the song that was playing, paused where it stopped (the browser does not let a page play by itself; play goes on from there). */
async function restoreNowPlaying() {
  try {
    const saved = (await chrome.storage.local.get(NOW_KEY))[NOW_KEY];
    if (!saved || saved.date !== todayKey() || player.current.id || audio.src || !Number.isInteger(saved.index)) return;
    const album = await poolAlbum(String(saved.id));
    if (!album) return;
    const tracks = await fetchTracks(album);
    if (!tracks[saved.index] || player.current.id || audio.src) return; // (the user started something meanwhile)
    player.album = album;
    player.current = { id: album.id, tracks, index: saved.index };
    player.cursor = album.id;
    const time = Number(saved.time) || 0;
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', () => {
      if (time > 0 && time < audio.duration - 1) audio.currentTime = time;
      audio.preload = 'none';
    }, { once: true });
    audio.src = tracks[saved.index].src;
    setMediaSession();
    markPlaying();
    emit(true);
  } catch { /* storage unavailable, or the album cannot be read */ }
}

async function restorePlayed() {
  try {
    const saved = (await chrome.storage.local.get(PLAYED_KEY))[PLAYED_KEY];
    if (!saved || saved.date !== todayKey() || !Array.isArray(saved.history) || history.length) return;
    const valid = saved.history.filter((h) => h && h.id !== undefined && Number.isInteger(h.index) && h.index >= 0 && h.index < 1000)
      .map((h) => ({ id: String(h.id), index: h.index, title: typeof h.title === 'string' ? h.title.slice(0, 200) : '' }));
    history.push(...valid);
    emit(true);
  } catch { /* storage unavailable */ }
}
const trackCache = new Map();    // album id -> { tracks, at }
let lastEmit = 0;
let queueCache = { key: '', items: [] };
let queueSentKey = null;         // (null: nothing was sent yet, so even an empty queue goes out the first time)
let savedCache = { key: '', items: [] };
let savedSentKey = null;         // (null: the first message carries the Liked list, even when it is empty: the bar needs to know it had none)
let recoveredAt = null;          // guards the one-shot recovery from an expired stream URL

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
  const html = await response.text();
  const tracks = (onBandcamp ? parseTracks : parseEmbeddedTracks)(html);
  const cover = html.match(/<meta property="og:image" content="([^"]+)"/);
  trackCache.set(album.id, { tracks, at: Date.now(), art: cover ? toMediaUrl(cover[1]) : '' });
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
  if (!player.waiting && !String(player.current.id).startsWith('w:')) {
    history.push({ id: player.current.id, index, title: tracks[index].title });
    if (history.length > 500) history.shift();
    savePlayed();
  }
  audio.src = tracks[index].src;
  audio.play().catch(() => {});
  saveNowPlaying(true);
  setMediaSession();
  markPlaying();
  emit(true);
  maintainRadio();
}

/**
 * Plays the song of a card: the one the artist highlights (or the first). `startIndex` plays that song instead (a song of Liked Songs, or
 * one that played before); `context` is where playback goes on from afterwards ('list' for the cards, 'liked' for Liked Songs).
 */
export async function playAlbum(id, startIndex = null, context = 'list') {
  if (startIndex === null && player.current.id === id && audio.src) { togglePlay(); return; }
  const album = await poolAlbum(id);
  if (!album) return;
  player.waiting = false;
  setAlbum(album);
  player.busy = true;
  player.message = '';
  emit(true);
  try {
    const tracks = await fetchTracks(album);
    if (!tracks.length) throw new Error('no streamable tracks');
    const first = startIndex !== null && startIndex < tracks.length ? startIndex : startingTrack(tracks);
    player.current = { id, tracks, index: first };
    player.context = context;
    if (context === 'list') player.cursor = id;
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

/** A song of Liked Songs: it plays, and playback goes on with the Liked Songs after it. */
export const playSavedTrack = (id, index) => playAlbum(id, index, 'liked');

/** A song that played before (a row of "Played"): it plays again, and playback goes on from where it was. */
export const playEarlierTrack = (id, index) => playAlbum(id, index, player.context);

/** The song of album `id` that is playing right now (with the id Bandcamp gives it), or null when another album plays. */
export function playingSongOf(id) {
  const { current } = player;
  const track = current.id === id && current.tracks[current.index];
  return track && track.trackId ? { i: current.index, title: track.title, trackId: track.trackId } : null;
}

/** The track that is playing, as the Liked list keeps it. */
export function currentTrack() {
  const { current, album } = player;
  const track = current.tracks[current.index];
  return album && track ? { id: album.id, i: current.index, title: track.title } : null;
}

// ── A song while waiting ────────────────────────────────────────────────

let lastWaitingUrl = '';
const collectionSources = () => ((session.state && session.state.owned && session.state.owned.sources) || [])
  .filter((source) => source.kind === 'collection' && isBandcampUrl(source.url));

/** True when there is a collection to pick a song from (the loading box shows the button only then). */
export const canPlayWhileWaiting = () => collectionSources().length > 0;

/** A random song from an album of the user's own collection (not the wishlist, not the recommendations). */
export async function playWaitingSong() {
  const sources = collectionSources();
  if (!sources.length) return;
  player.waiting = true;
  player.busy = true;
  player.message = '';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const pick = sources[Math.floor(Math.random() * sources.length)];
    if (sources.length > 1 && pick.url === lastWaitingUrl) continue;
    lastWaitingUrl = pick.url;
    const album = { id: `w:${pick.url}`, url: pick.url, title: pick.title, artist: pick.artist, art: '' };
    try {
      const tracks = await fetchTracks(album);
      if (!tracks.length) continue;
      if (!player.waiting) return; // something else started in the meantime
      album.art = (trackCache.get(album.id) || {}).art || '';
      player.album = album;
      player.current = { id: album.id, tracks, index: startingTrack(tracks) };
      playTrack(player.current.index);
      return;
    } catch { /* try another album */ }
  }
  player.busy = false;
  player.waiting = false;
  player.message = "Couldn't play a song. Try again.";
  emit(true);
}

/** The button of the loading box: pauses and resumes the song, or starts one. */
export function toggleWaiting() {
  if (player.waiting && audio.src) return togglePlay();
  return playWaitingSong();
}

/** What the loading box says about the song: playing (with its names) or not. */
export const waitingInfo = () => {
  const track = player.current.tracks[player.current.index];
  return { playing: player.waiting && !audio.paused && Boolean(track), busy: player.waiting && player.busy, artist: player.album ? player.album.artist : '', song: track ? track.title : '' };
};
waiting.can = canPlayWhileWaiting;
waiting.toggle = toggleWaiting;
waiting.info = waitingInfo;
let waitingKey = '';

// ── Transport ───────────────────────────────────────────────────────────────────────────────────────────────────

/** The cards of the list, in the order of the page. */
const listIds = () => visibleCardIds();

/** The card after the cursor, or null at the end of what is loaded. */
const cardAfterCursor = () => {
  const ids = listIds();
  return ids.slice(ids.indexOf(player.cursor) + 1).find((id) => id !== player.current.id) || null;   // (not the album that plays now)
};

/** Albums of the list that are still to come (the radio asks for more when this runs low). */
const cardsLeft = () => {
  const ids = listIds();
  const at = ids.indexOf(player.cursor);
  return at < 0 ? ids.length : ids.length - 1 - at;
};

/** What plays next: { id, index } (index null: the song of the card), or null at the end. In Liked Songs it is the next Liked Song. */
function whatIsNext() {
  if (player.context === 'liked') {
    const liked = savedItems().items;
    const at = liked.findIndex((song) => song.id === player.current.id && song.i === player.current.index);
    if (at >= 0 && liked[at + 1]) return { id: liked[at + 1].id, index: liked[at + 1].i, context: 'liked' };
    // the Liked Songs ran out: the list goes on from where it was
  }
  const id = cardAfterCursor();
  return id ? { id, index: null, context: 'list' } : null;
}

const startFirst = () => { const first = listIds()[0]; return first && playAlbum(first); };

export const togglePlay = () => {
  if (!player.current.id) return startFirst();
  if (!player.waiting && audio.ended && !whatIsNext()) { history.length = 0; savePlayed(); return startFirst(); } // the end: play starts the list again
  return audio.paused ? audio.play().catch(() => {}) : audio.pause();
};
export const pause = () => audio.pause();

export async function nextTrack() {
  if (player.waiting) return session.running ? playWaitingSong() : skipToList();
  if (!player.current.id) return startFirst();
  let next = whatIsNext();
  if (!next) { // the end of what is loaded: the radio asks for the next batch (or it is already on its way)
    toast('Loading more albums…');
    if (await moreForRadio()) next = whatIsNext();
    else toast('No more albums for today. Come back tomorrow, or pick another list.');
  }
  return next && playAlbum(next.id, next.index, next.context);
}

/** The song of the loading box is not part of any list: the next button then goes to the first card. */
function skipToList() {
  return startFirst();
}

export async function previousTrack() {
  if (player.waiting) { audio.currentTime = 0; return; }
  // back along the songs that played (or to the start of this one, when it has been playing a while)
  if (audio.currentTime > 3 || history.length < 2) { audio.currentTime = 0; return; }
  history.pop();
  const before = history.pop();
  playAlbum(before.id, before.index, player.context);
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

// ── The radio: more albums are asked for in the background, so the list does not end ────────────────────────────────

const RADIO_BATCH = 50;                       // albums asked for at a time
const RADIO_LOW = 10;                         // when this few albums are left to play, the next batch is asked for
const RADIO_MAX = 300;                        // a list never grows past this many albums in a day
const RADIO_RETRY_MS = 10 * 60 * 1000;        // after a batch that brought nothing, nothing is asked for again for a while
let radioBusy = false;
let radioPausedUntil = 0;
let radioPrimed = '';                         // the list that already got its first extra batch

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The cards of new albums arrive through the storage change: waits (a few seconds at most) until they are on the page. */
async function waitForCards(ids) {
  for (let i = 0; i < 25 && !ids.every((id) => findCard(id)); i += 1) await sleepMs(200);
}

/** The line under the list that says more albums are on their way. */
function showMoreStatus(on) {
  const line = document.getElementById('more-status');
  if (line) line.hidden = !on;
}

/** Asks for the next batch in the background. Resolves with the ids that were added (none when nothing more fits). */
async function loadMoreAlbums() {
  if (radioBusy) return [];
  radioBusy = true;
  showMoreStatus(true);
  try {
    const reply = await send({ type: MSG.EXTEND_LIST, view: session.view, tags: session.tagKeys, count: RADIO_BATCH });
    const ids = reply && reply.ok && Array.isArray(reply.ids) ? reply.ids : [];
    if (ids.length) await waitForCards(ids); else radioPausedUntil = Date.now() + RADIO_RETRY_MS;
    return ids;
  } catch {
    radioPausedUntil = Date.now() + RADIO_RETRY_MS;
    return [];
  } finally {
    radioBusy = false;
    showMoreStatus(false);
  }
}

/** The list ran out while a batch is being loaded (or none was): waits for it. True when there are albums to play again. */
async function moreForRadio() {
  for (let i = 0; i < 400 && radioBusy; i += 1) await sleepMs(300);
  if (cardsLeft() > 0) return true;
  return (await loadMoreAlbums()).length > 0;
}

/** Called when a list is drawn and when a song starts: keeps albums ahead, so the list does not end. */
export function maintainRadio() {
  if (radioBusy || Date.now() < radioPausedUntil || player.waiting) return;
  if (!session.hasList || session.pending || session.landing || session.newDay) return;
  const ids = visibleCardIds();
  if (!ids.length || ids.length >= RADIO_MAX) return;
  const listKey = `${session.view}|${session.tagKeys.join('+')}|${session.loadedDay}`;
  const first = radioPrimed !== listKey && ids.length <= RADIO_BATCH;   // a list that was just loaded gets a batch at once
  if (!first && cardsLeft() > RADIO_LOW) return;
  radioPrimed = listKey;
  loadMoreAlbums();
}

/** The album that was playing was removed from the list: move on to the next card. */
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

// ── The queue ───────────────────────────────────────────────────────────────────────────────────────────────

const httpsOrEmpty = (url) => (/^https:\/\//i.test(url || '') ? url : '');

/** What a row of the queue says about an album, read once per album for one drawing (null when the album has no card on the page). */
function rowBaseReader() {
  const cache = new Map();
  return (id) => {
    if (!cache.has(id)) {
      const card = findCard(id);
      const pooled = (session.state && session.state.pool && session.state.pool[id]) || {};
      cache.set(id, card ? {
        id,
        album: card.dataset.album || card.querySelector('.album-title').textContent,
        artist: card.querySelector('.album-artist').textContent,
        art: pooled.art || '',
        url: httpsOrEmpty(pooled.url),
        wished: session.wished.has(id),
      } : null);
    }
    return cache.get(id);
  };
}

/** Adds to the rows of the queue what only the page knows: the cover, the link, the wishlist, whether the song is in Liked Songs. Rows of albums with no card are left out. */
function withBase(rows, base) {
  const items = [];
  for (const row of rows) {
    const info = base(row.id);
    if (!info) continue;
    const item = { ...info, ...row, saved: row.i >= 0 && session.saved.has(`${row.id}:${row.i}`) };
    if (row.placeholder) item.title = info.album;
    items.push(item);
  }
  return items;
}

/** The song a card is for (the one the radio plays from that album), or null when it is not known (a list made by an older version). */
const songOfCard = (id) => {
  const album = session.state && session.state.pool && session.state.pool[id];
  return album && album.song && album.song.title ? { i: album.song.i, title: album.song.title } : null;
};

/** The queue for the bar, rebuilt only when what it shows changes. */
function queueItems() {
  const { current, context } = player;
  const track = current.tracks[current.index];
  const { rows, more, total, played } = playbackQueue({
    context,
    order: listIds(),
    cursorId: player.cursor,
    current: { id: player.waiting ? null : current.id, index: current.index, title: track ? track.title : '' },
    history,
    songOf: songOfCard,
    liked: context === 'liked' ? savedItems().items.map(({ id, i, title }) => ({ id, i, title })) : [],
  });
  const items = withBase(rows, rowBaseReader());
  const rowKey = (it) => `${it.id}:${it.i === undefined ? '' : it.i}${it.sec || ''}${it.liked ? 'L' : ''}${it.wished ? 'w' : ''}${it.saved ? 's' : ''}${it.placeholder ? 'p' : ''}`;
  const key = `${context}|${total}|${played}|${more ? 'm' : ''}|${items.map(rowKey).join(',')}`;
  if (key !== queueCache.key) queueCache = { key, items, albums: total, more, played };
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
        id: entry.id, i: entry.i, title: entry.title || `Track ${entry.i + 1}`, art: state.pool[entry.id].art || '', artist: state.pool[entry.id].artist, album: state.pool[entry.id].title || '', url: httpsOrEmpty(state.pool[entry.id].url), wished: session.wished.has(entry.id),
      })),
    };
  }
  return savedCache;
}

/** Page of the song that is playing; the album's page when the song has none (or its address looks odd). */
function trackUrl(album, track) {
  if (!album) return '';
  try {
    const url = new URL((track && track.link) || '', album.url);
    return url.protocol === 'https:' && track && track.link ? url.href : album.url;
  } catch { return album.url; }
}

/** The previous button: the song that played before. Nothing to go back to for the song of the loading box. */
const canGoBack = () => !player.waiting && history.length > 1;

/**
 * The next button: always on while the radio can still bring albums (at the end of what is loaded it asks for more, or says there are none).
 * The loading box's song always has a next.
 */
const canGoForward = () => player.waiting || Boolean(whatIsNext()) || listIds().length < RADIO_MAX;

function snapshot() {
  const { current, album } = player;
  const track = current.tracks[current.index];
  const queue = queueItems();
  const snap = {
    has: session.hasList, plain: player.waiting, // (the bar stays hidden while the list is built: the loading box has the button)
    art: album ? album.art : '', url: trackUrl(album, track),
    albumTitle: album ? album.title : '', songTitle: track ? track.title : '', artist: album ? album.artist : '',
    trackNo: track ? current.index + 1 : 0, track: track ? track.title : '', msg: player.message,
    busy: player.busy || (!audio.paused && audio.readyState < 3),
    playing: !audio.paused, cur: audio.currentTime || 0, dur: audio.duration || 0,
    buf: audio.buffered.length ? audio.buffered.end(audio.buffered.length - 1) : 0,
    vol: audio.muted ? 0 : audio.volume,
    curId: current.id,
    wished: Boolean(album) && session.wished.has(album.id),
    isSaved: Boolean(album && track) && session.saved.has(`${album.id}:${current.index}`),
    disliked: Boolean(album) && session.dislikedThisVisit.has(album.id),
    context: player.context,
    hasPrev: canGoBack(),
    hasNext: canGoForward(),
    queueAlbums: queue.albums, queueMore: queue.more, queuePlayed: queue.played,
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
  const info = waitingInfo();
  const key = `${info.playing}|${info.busy}|${info.artist}|${info.song}`;
  if (key !== waitingKey) { waitingKey = key; waiting.listeners.forEach((listener) => listener(info)); }
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
    const saved = localStorage.getItem(VOLUME_KEY);
    if (saved !== null && Number.isFinite(+saved)) audio.volume = Math.max(0, Math.min(1, +saved));
  } catch { /* storage unavailable */ }
  registerMediaSessionHandlers();
  restorePlayed().then(restoreNowPlaying);
  addEventListener('pagehide', () => { saveNowPlaying(true); writePlayed(); }); // (what is waiting in the 300 ms delay goes out as the page closes)
  audio.addEventListener('ended', nextTrack); // (a song while waiting: another one, until the list is ready)
  audio.addEventListener('error', recoverFromAudioError);
  audio.addEventListener('play', markPlaying);
  audio.addEventListener('pause', markPlaying);
  for (const type of ['play', 'pause', 'timeupdate', 'loadedmetadata', 'volumechange', 'waiting', 'playing', 'canplay', 'progress']) {
    audio.addEventListener(type, () => {
      emit(type !== 'timeupdate' && type !== 'progress');
      if (type === 'timeupdate') { saveNowPlaying(false); countAsPlayed(); }
      else if (type === 'pause') saveNowPlaying(true);
    });
  }
}
