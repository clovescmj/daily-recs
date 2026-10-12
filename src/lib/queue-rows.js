// Which rows the queue shows. The page gives what it knows (the order of the albums, the song that plays, what played, the songs it has read); the rows come back
// as plain objects, without anything from the page, so the rules can be tested. The page adds to each row what only it knows (the cover, the link, the wishlist).

/** Full album: the songs of the album that plays and of the albums after it, up to this many. */
export const QUEUE_AHEAD = 3;

/** Where an album starts: the track the artist highlights on Bandcamp, or the first one when none is set. */
export const startingTrack = (tracks) => Math.max(0, tracks.findIndex((track) => track.featured));

/** Which albums the queue shows songs of: the one that plays (`at`, -1 when none of the list) and the ones after it; `more` when the list goes on after them. */
export function queueWindow(ids, currentId, ahead = QUEUE_AHEAD) {
  const at = ids.indexOf(currentId);
  const from = at >= 0 ? at + 1 : 0;
  return { at, ahead: ids.slice(from, from + ahead), more: from + ahead < ids.length };
}

/** What already played, in the order it played, each song once (the song that plays now is not in it). `history` entries are { id, index, title }. */
function playedSongs(history, current) {
  const songs = new Map();
  for (const h of history) {
    const key = `${h.id}:${h.index}`;
    songs.delete(key);          // a song that played again goes to the end
    songs.set(key, h);
  }
  return [...songs.values()].filter((h) => !(h.id === current.id && h.index === current.index));
}

/**
 * Full album: what played, the song that plays, the rest of its album, and the songs of the next albums (one placeholder row for an album whose songs are not read).
 * `order` is the ids of the list; `current` is { id, index, tracks }; `tracksOf(id)` is the songs of an album that were read, or null.
 * A row is { id, i, title, track: true, sec: 'played' | 'now' | 'next' }, or { id, i: -1, placeholder: true, sec: 'next' } (the page names it by its album).
 */
export function albumQueue({ order, current, history, tracksOf }) {
  const win = queueWindow(order, current.id);
  const rows = [];
  const songRow = (id, i, tracks, sec, fallback = '') => {
    rows.push({ id, i, title: tracks[i] ? tracks[i].title : (fallback || `Track ${i + 1}`), track: true, sec });
  };

  for (const h of playedSongs(history, current)) songRow(h.id, h.index, tracksOf(h.id) || [], 'played', h.title);

  if (win.at >= 0) {
    current.tracks.forEach((track, i) => {
      if (i >= current.index) songRow(current.id, i, current.tracks, i === current.index ? 'now' : 'next');
    });
  }

  for (const id of win.ahead) {
    const tracks = tracksOf(id);
    if (tracks) tracks.forEach((track, i) => songRow(id, i, tracks, 'next'));
    else rows.push({ id, i: -1, placeholder: true, sec: 'next' });
  }
  return { rows, more: win.more, played: Math.max(0, win.at) };
}

/**
 * Shuffle: one row per album, in the order of the round, with the song that comes from it. Which song:
 *  - the album that plays: its current song;
 *  - an album before it in the round: the song that played from it;
 *  - an album after it: the song already chosen for it (`pending`, a Map of id to track number), or, when nothing of it played yet, the one its artist highlights.
 * A row whose song is not known yet (its songs are not read, or it already played in an earlier round and none was chosen) has `i: -1` and no title: the page names it by its album.
 */
export function shuffleQueue({ order, current, history, pending, tracksOf }) {
  const at = order.indexOf(current.id);
  const lastPlayed = new Map();
  for (const h of history) lastPlayed.set(h.id, h);

  const songOf = (id, pos) => {
    if (id === current.id) return { i: current.index, tracks: current.tracks };
    const tracks = tracksOf(id);
    const played = lastPlayed.get(id);
    if (at >= 0 && pos < at && played) return { i: played.index, tracks, title: played.title };
    if (pending.has(id)) return { i: pending.get(id), tracks };
    if (!played && tracks) return { i: startingTrack(tracks), tracks };
    return { i: -1, tracks };
  };

  const rows = order.map((id, pos) => {
    const { i, tracks, title: kept } = songOf(id, pos);
    const title = i >= 0 ? (tracks && tracks[i] ? tracks[i].title : kept || '') : '';
    return title ? { id, i, title, named: true } : { id, i: -1, placeholder: true };
  });
  return { rows, more: false, played: Math.max(0, at) };
}
