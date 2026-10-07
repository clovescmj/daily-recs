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
  constructor() { super('Not signed in to Bandcamp'); this.name = 'NotLoggedInError'; }
}
export class HttpError extends Error {
  constructor(status, url) { super(`HTTP ${status}`); this.name = 'HttpError'; this.status = status; this.url = url; }
}
export class RateLimitedError extends Error {
  constructor() { super('Bandcamp is limiting requests right now'); this.name = 'RateLimitedError'; }
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
export async function loadLibrary(fetchFn, profileUrl, options) {
  const blob = parseProfileBlob(await fetchText(fetchFn, profileUrl, options));
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
  };
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

const MAX_TAGS = 8;

/**
 * Genre tags of an album page. Bandcamp writes genre tags in lower case and location tags ("Brooklyn",
 * "Los Angeles, California") with a capital letter; locations say nothing about taste, so they are dropped.
 */
export function parseTags(html) {
  const tags = [];
  const pattern = /<a class="tag"\s+href="([^"]*)"\s*>([^<]*)<\/a>/g;
  let match;
  while ((match = pattern.exec(html)) && tags.length < MAX_TAGS) {
    const [, href, label] = match;
    const text = decodeHtmlEntities(label).trim();
    if (!/\/discover\//.test(href) || !text || /^\p{Lu}/u.test(text) || text.includes(',') || text.length > 40) continue;
    if (!tags.includes(text.toLowerCase())) tags.push(text.toLowerCase());
  }
  return tags;
}

/** Streamable tracks of an album page. Stream URLs expire, so this is read right before playing. */
export function parseTracks(html) {
  const match = html.match(/data-tralbum="([^"]+)"/);
  if (!match) return [];
  const tralbum = JSON.parse(decodeHtmlEntities(match[1]));
  return (tralbum.trackinfo || [])
    .map((track) => ({ title: toLabel(track.title), src: toHttpsUrl(track.file && track.file['mp3-128']), duration: track.duration }))
    .filter((track) => track.src);
}
