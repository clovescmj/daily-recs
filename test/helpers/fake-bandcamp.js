// A tiny fake of the parts of Bandcamp the extension talks to, so tests are fast, offline and deterministic.
//   - profile page with the embedded first page of the collection + wishlist and the pagination API
//   - album pages with a "you may also like" section built from a fixed candidate catalogue
//   - failure injection (status codes per URL pattern) to exercise retries and the circuit breaker
const escapeAttr = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export function createFakeBandcamp({
  libraryCount = 80, wishlistCount = 10, candidateCount = 300, recsPerPage = 8, firstPageSize = 20,
  sourceTags = () => [], candidateTags = () => [],
} = {}) {
  const profileUrl = 'https://bandcamp.com/tester';
  const item = (n, kind) => ({
    item_url: `https://src${n}.bandcamp.com/album/${kind}-${n}?from=x`, item_title: `${kind} ${n}`, band_name: `Source Artist ${n}`,
    tralbum_id: 100000 + n, band_id: 500000 + n, item_id: 100000 + n,
  });
  const collection = Array.from({ length: libraryCount }, (_, i) => item(i, 'owned'));
  const wishlist = Array.from({ length: wishlistCount }, (_, i) => item(10000 + i, 'wish'));
  const candidates = Array.from({ length: candidateCount }, (_, i) => ({
    id: 900000 + i, artistId: 800000 + i, title: `Candidate ${i}`, artist: `Candidate Artist ${i}`,
    url: `https://cand${i}.bandcamp.com/album/candidate-${i}`,
  }));

  const calls = [];
  const failures = []; // { match: RegExp, status: number, times?: number }

  const page = (items, kind) => {
    const first = items.slice(0, firstPageSize);
    return { item_count: items.length, last_token: `${kind}:${first.length}`, first };
  };
  const pages = { collection: page(collection, 'collection'), wishlist: page(wishlist, 'wishlist') };
  const blob = {
    fan_data: { fan_id: 1881602, username: 'tester', name: 'Tester', is_own_page: true },
    collection_data: { item_count: collection.length, last_token: pages.collection.last_token },
    wishlist_data: { item_count: wishlist.length, last_token: pages.wishlist.last_token },
    item_cache: {
      collection: Object.fromEntries(pages.collection.first.map((it, i) => [`a${i}`, it])),
      wishlist: Object.fromEntries(pages.wishlist.first.map((it, i) => [`a${i}`, it])),
    },
  };
  const profileHtml = `<div id="pagedata" data-blob="${escapeAttr(JSON.stringify(blob))}"></div>`;

  /** Each source recommends `recsPerPage` candidates; sources overlap so popular candidates get higher scores. */
  const recsFor = (n) => Array.from({ length: recsPerPage }, (_, k) => candidates[(n * 7 + k * 13 + (n % 3)) % candidateCount]);
  const tagsHtml = (tags) => tags.map((tag) => `
    <a class="tag" href="https://bandcamp.com/discover/${tag}?from=tralbum&artist=1"
       >${tag}</a>`).join('');
  const albumHtml = (n, tags = []) => tagsHtml(tags) + recsFor(n).map((c, k) => `
    <li class="recommended-album footer-cc" id="id-${c.id}" data-albumtitle="${escapeAttr(c.title)}" data-albumid="${c.id}"
        data-artist="${escapeAttr(c.artist)}" data-artistid="${c.artistId}">
      <img class="album-art" src="https://f4.bcbits.com/img/a${c.id}_16.jpg">
      <a class="album-link" href="${c.url}?from=footer"><span class="release-title">${c.title}</span></a>
      <p class="supporters-text">supported by ${3 + k} fans who also own “owned ${n}”</p>
    </li>`).join('');

  const respond = (body, { json = false, status = 200 } = {}) => ({
    ok: status >= 200 && status < 300, status, headers: { get: () => null },
    text: async () => (json ? JSON.stringify(body) : body), json: async () => body,
  });

  async function fakeFetch(url, options = {}) {
    url = String(url);
    calls.push({ url, method: options.method || 'GET' });
    const failure = failures.find((f) => f.match.test(url) && (f.times === undefined || f.times > 0));
    if (failure) { if (failure.times !== undefined) failure.times--; return respond('', { status: failure.status }); }

    if (url.endsWith('/api/fan/2/collection_summary')) return respond({ fan_id: 1881602, collection_summary: { url: profileUrl } }, { json: true });
    if (url === profileUrl) return respond(profileHtml);
    const listing = url.match(/\/api\/fancollection\/1\/(collection|wishlist)_items$/);
    if (listing) {
      const kind = listing[1];
      const all = kind === 'collection' ? collection : wishlist;
      const body = JSON.parse(options.body);
      const offset = Number(String(body.older_than_token).split(':')[1]);
      const slice = all.slice(offset, offset + 100);
      const next = offset + slice.length;
      return respond({ items: slice, last_token: `${kind}:${next}`, more_available: next < all.length }, { json: true });
    }
    const source = url.match(/https:\/\/src(\d+)\.bandcamp\.com\/album\//);
    if (source) return respond(albumHtml(Number(source[1]), sourceTags(Number(source[1]))));
    const candidatePage = url.match(/https:\/\/cand(\d+)\.bandcamp\.com\/album\//); // liked albums are read too
    if (candidatePage) return respond(albumHtml(20000 + Number(candidatePage[1]), candidateTags(Number(candidatePage[1]))));
    return respond('', { status: 404 });
  }

  return {
    fetch: fakeFetch, profileUrl, calls, failures, collection, wishlist, candidates,
    ownedIds: new Set([...collection, ...wishlist].map((it) => String(it.tralbum_id))),
    recsFor,
  };
}
