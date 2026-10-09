// Everything that talks to Bandcamp: HTTP with a sane retry policy, parsing of profile/album pages, and input
// sanitising. Pure ES module (no chrome.* APIs, no DOM) so it runs in the service worker and in Node tests.
// DOMParser is not available in service workers, hence the regex-based parsing.

export const BANDCAMP_ORIGIN = 'https://bandcamp.com';

const RETRY_BASE_MS = 1500;
const MAX_RETRY_AFTER_MS = 30_000;
const PAGE_DELAY_MS = 200;
const MAX_COLLECTION_PAGES = 200; // hard stop in case the pagination token never advances
const MAX_TEXT_LENGTH = 300;

export class NotLoggedInError extends Error {
  constructor() { super("You're not signed in to Bandcamp."); this.name = 'NotLoggedInError'; }
}
export class HttpError extends Error {
  constructor(status, url) { super(`HTTP ${status}`); this.name = 'HttpError'; this.status = status; this.url = url; }
}
export class RateLimitedError extends Error {
  constructor() { super('Bandcamp asked us to slow down.'); this.name = 'RateLimitedError'; }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------------------------------------------------
// Sanitising. Everything parsed from remote HTML is untrusted: ids must be numeric and URLs must be https.
// ---------------------------------------------------------------------------------------------------------------------

export function decodeHtmlEntities(text = '') {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

export const stripQuery = (url) => (url || '').split('?')[0];

/** Returns the normalised URL if it is a valid https URL, otherwise ''. */
export function toHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

/** Bandcamp ids are plain digits. Anything else is rejected. */
export const toNumericId = (value) => (/^\d{1,20}$/.test(String(value ?? '')) ? String(value) : '');

const toLabel = (value) => String(value ?? '').slice(0, MAX_TEXT_LENGTH);

// ---------------------------------------------------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------------------------------------------------

/**
 * fetch with a retry policy that only retries what can succeed on a second attempt: network failures, 429 (honouring
 * Retry-After) and 5xx. Other 4xx responses fail immediately.
 */
async function request(fetchFn, url, init = {}, { retries = 2, baseDelayMs = RETRY_BASE_MS } = {}) {
  for (let attempt = 0; ; attempt++) {
    let response;
    try {
      response = await fetchFn(url, { credentials: 'include', ...init });
    } catch (networkError) {
      if (attempt >= retries) throw networkError;
      await sleep(baseDelayMs * (attempt + 1));
      continue;
    }
    if (response.ok) return response;
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= retries) {
      throw response.status === 429 ? new RateLimitedError() : new HttpError(response.status, url);
    }
    const retryAfterSeconds = Number(response.headers?.get?.('Retry-After'));
    const wait = retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : baseDelayMs * 2 * (attempt + 1);
    await sleep(Math.min(MAX_RETRY_AFTER_MS, wait));
  }
}

export const fetchText = async (fetchFn, url, options) => (await request(fetchFn, url, {}, options)).text();

// ---------------------------------------------------------------------------------------------------------------------
// Who is signed in, and what they own
// ---------------------------------------------------------------------------------------------------------------------

/** Identifies the signed-in fan. Throws NotLoggedInError when nobody is signed in. */
export async function getFan(fetchFn) {
  const response = await fetchFn(`${BANDCAMP_ORIGIN}/api/fan/2/collection_summary`, { credentials: 'include' });
  const json = await response.json().catch(() => null);
  if (!json || json.error) throw new NotLoggedInError();
  const summary = json.collection_summary || {};
  const profileUrl = toHttpsUrl(summary.url || (summary.username ? `${BANDCAMP_ORIGIN}/${summary.username}` : ''));
  if (!profileUrl) throw new NotLoggedInError();
  return { fanId: toNumericId(json.fan_id || summary.fan_id), profileUrl };
}

function parseProfileBlob(html) {
  const match = html.match(/id="pagedata"\s+data-blob="([^"]+)"/);
  if (!match) throw new Error("Couldn't find the collection data on the profile page.");
  return JSON.parse(decodeHtmlEntities(match[1]));
}

/** Reads every item of a fan's 'collection' or 'wishlist' (the profile page embeds only the first page). */
async function fetchAllItems(fetchFn, blob, kind, options) {
  const data = blob[`${kind}_data`];
  const items = Object.values((blob.item_cache && blob.item_cache[kind]) || {});
  if (!data || !data.item_count) return items;
  let token = data.last_token;
  for (let page = 0; page < MAX_COLLECTION_PAGES; page++) {
    let json;
    try {
      const response = await request(fetchFn, `${BANDCAMP_ORIGIN}/api/fancollection/1/${kind}_items`, {
        method: 'POST',
        body: JSON.stringify({ fan_id: blob.fan_data.fan_id, older_than_token: token, count: 100 }),
      }, { retries: 3, ...options });
      json = await response.json();
    } catch {
      throw new Error(`Couldn't read your ${kind} from Bandcamp.`);
    }
    items.push(...(json.items || []));
    if (!json.more_available || json.last_token === token) break;
    token = json.last_token;
    await sleep(options?.pageDelayMs ?? PAGE_DELAY_MS);
  }
  return items;
}

const uniqueBy = (items, keyOf) => [...new Map(items.map((item) => [keyOf(item), item])).values()];

/**
 * Snapshot of what the fan already has (collection + wishlist). Nothing in here may ever be recommended, and every
 * item doubles as a "source" whose "you may also like" section we read.
 */
export async function loadLibrary(fetchFn, profileUrl, options, previous = null, now = Date.now()) {
  const blob = parseProfileBlob(await fetchText(fetchFn, profileUrl, options));
  // The profile page already says how many items there are and which are the newest: when that is what was saved (and the saved copy
  // is not old), the rest of the library is not read again (one request instead of dozens).
  const fingerprint = libraryFingerprint(blob);
  if (previous && previous.fingerprint === fingerprint && now - (previous.loadedAt || 0) < MAX_LIBRARY_AGE_MS) return previous;
  const collection = uniqueBy(await fetchAllItems(fetchFn, blob, 'collection', options), (i) => stripQuery(i.item_url));
  const wishlist = await fetchAllItems(fetchFn, blob, 'wishlist', options);
  // Bandcamp lists newest first, so the position in each list tells how recent an item is (1 = newest, 0 = oldest).
  const tagged = (items, kind) => items.map((item, index) => ({ item, kind, recent: items.length > 1 ? 1 - index / (items.length - 1) : 1 }));
  const everything = uniqueBy([...tagged(collection, 'collection'), ...tagged(wishlist, 'wishlist')], ({ item }) => stripQuery(item.item_url));
  const items = everything.map(({ item }) => item);
  return {
    sources: everything.map(({ item, kind, recent }) => ({
      url: stripQuery(item.item_url), title: toLabel(item.item_title), artist: toLabel(item.band_name), kind, recent: Math.round(recent * 100) / 100,
    })),
    ids: [...new Set(items.map((i) => String(i.tralbum_id || i.item_id)))],
    bandIds: [...new Set(items.map((i) => String(i.band_id)))],
    urls: [...new Set(items.map((i) => stripQuery(i.item_url)))],
    collectionCount: collection.length,
    wishlistCount: wishlist.length,
    fingerprint,
    loadedAt: now,
  };
}

const MAX_LIBRARY_AGE_MS = 7 * 86_400_000;   // the saved library is read again at least once a week

/** What the profile page says about the library: its sizes and the newest item of each list. A purchase or a save changes it. */
function libraryFingerprint(blob) {
  const newest = (kind) => {
    const first = Object.values((blob.item_cache && blob.item_cache[kind]) || {})[0];
    return first ? stripQuery(first.item_url) : '';
  };
  const count = (kind) => (blob[`${kind}_data`] || {}).item_count || 0;
  return [count('collection'), count('wishlist'), newest('collection'), newest('wishlist')].join('|');
}

// ---------------------------------------------------------------------------------------------------------------------
// Album pages
// ---------------------------------------------------------------------------------------------------------------------

/** Extracts the "you may also like" section of an album/track page. Invalid entries are dropped. */
export function parseRecommendations(html) {
  const recommendations = [];
  const itemPattern = /<li class="recommended-album[^"]*"([^>]*)>([\s\S]*?)<\/li>/g;
  let match;
  while ((match = itemPattern.exec(html))) {
    const [, attributes, body] = match;
    const attribute = (name) => {
      const found = attributes.match(new RegExp(`${name}="([^"]*)"`));
      return found ? decodeHtmlEntities(found[1]) : '';
    };
    const href = (body.match(/href="([^"]+)"/) || [])[1];
    const art = (body.match(/class="album-art"\s+src="([^"]+)"/) || [])[1] || '';
    const supporters = body.match(/supported by (\d+) fans? who also own\s+[“"]([^”"]*)[”"]/);
    const id = toNumericId(attribute('data-albumid'));
    const url = stripQuery(toHttpsUrl(decodeHtmlEntities(href || '')));
    if (!id || !url) continue;
    recommendations.push({
      id,
      title: toLabel(attribute('data-albumtitle')),
      artist: toLabel(attribute('data-artist')),
      artistId: toNumericId(attribute('data-artistid')),
      url,
      art: toHttpsUrl(decodeHtmlEntities(art)),
      fans: supporters ? +supporters[1] : 0,
      ownedTitle: supporters ? toLabel(decodeHtmlEntities(supporters[2])) : '',
    });
  }
  return recommendations;
}

import { isPlace } from './places.js';

const MAX_TAGS = 8;
export const TAG_SEPARATORS = /[#,;/]/;

// The same genre is written many ways ("e.b.m", "EBM", "electronic body music"; "dark wave", "darkwave"): they must count as one.
const TAG_ALIASES = Object.freeze({ electronicbodymusic: 'ebm' });
export function normalizeTag(text) {
  const key = String(text).toLowerCase().replace(/[\s._-]+/g, '');
  return TAG_ALIASES[key] || key;
}

/**
 * Genre tags of an album page, as { key, label }: `key` is the normalised form (see normalizeTag), `label` the text as the
 * artist wrote it. Bandcamp writes genre tags in lower case and location tags ("Brooklyn",
 * "Los Angeles, California") with a capital letter; locations say nothing about taste, so they are dropped.
 */
export function parseTagLabels(html) {
  const tags = [];
  const pattern = /<a class="tag"\s+href="([^"]*)"\s*>([^<]*)<\/a>/g;
  let match;
  while ((match = pattern.exec(html)) && tags.length < MAX_TAGS) {
    const [, href, label] = match;
    if (!/\/discover\//.test(href)) continue;
    // some artists write a whole list in one tag ("punk #ebm #lofi", "rock, punk", "hip-hop/rap"): each one is a tag of its own
    for (const text of decodeHtmlEntities(label).split(TAG_SEPARATORS).map((part) => part.trim())) {
      if (text.length < 2 || /^\p{Lu}/u.test(text) || text.length > 40 || tags.length >= MAX_TAGS) continue;
      const key = normalizeTag(text);
      if (isPlace(key) || tags.some((tag) => tag.key === key)) continue; // a city or a country says where the music is from, not what it sounds like
      tags.push({ key, label: text.toLowerCase() });
    }
  }
  return tags;
}

/** Same as parseTagLabels, keys only. */
export const parseTags = (html) => parseTagLabels(html).map((tag) => tag.key);

/**
 * True for pages the extension is allowed to read (bandcamp.com and its subdomains). Some labels use their own domain
 * (e.g. listen.20buckspin.com): the browser blocks reading those from the extension, so they are skipped or read through
 * Bandcamp's embedded player instead.
 */
export const isBandcampUrl = (url) => /^https:\/\/([a-z0-9-]+\.)*bandcamp\.com(\/|$)/i.test(String(url));

/** Address of Bandcamp's embedded player page for an album: it lists the tracks of any album, whatever its own domain. */
export const embeddedPlayerUrl = (albumId) =>
  `${BANDCAMP_ORIGIN}/EmbeddedPlayer/album=${toNumericId(albumId)}/size=large/tracklist=false/artwork=none/transparent=true/`;

/** Same result as parseTracks, from the embedded player page. */
export function parseEmbeddedTracks(html) {
  const match = html.match(/data-player-data="([^"]+)"/);
  if (!match) return [];
  const data = JSON.parse(decodeHtmlEntities(match[1]));
  return (data.tracks || [])
    .map((track) => ({
      title: toLabel(track.title),
      link: typeof track.title_link === 'string' ? track.title_link : '', // the song's own page (relative to the album's site)
      src: toHttpsUrl(track.file && track.file['mp3-128']),
      duration: track.duration,
      featured: Boolean(data.featured_track_id) && String(track.id) === String(data.featured_track_id),
    }))
    .filter((track) => track.src);
}

/**
 * Streamable tracks of an album page (`featured` marks the one the artist chose to highlight, if any). Stream URLs
 * expire, so this is read right before playing.
 */
export function parseTracks(html) {
  const match = html.match(/data-tralbum="([^"]+)"/);
  if (!match) return [];
  const tralbum = JSON.parse(decodeHtmlEntities(match[1]));
  return (tralbum.trackinfo || [])
    .map((track) => ({
      title: toLabel(track.title),
      link: typeof track.title_link === 'string' ? track.title_link : '', // the song's own page (relative to the album's site)
      src: toHttpsUrl(track.file && track.file['mp3-128']),
      duration: track.duration,
      featured: Boolean(tralbum.featured_track_id) && String(track.track_id ?? track.id) === String(tralbum.featured_track_id),
    }))
    .filter((track) => track.src);
}
