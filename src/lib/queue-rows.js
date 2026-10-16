// Which rows the queue shows. The page gives what it knows (the order of the cards, where playback is, the song that plays, what played,
// the Liked Songs); the rows come back as plain objects, without anything from the page, so the rules can be tested. The page adds to each
// row what only it knows (the cover, the link, the wishlist).
//
// The sequence is always the same: the cards of the list, in the order they are on the page. The one exception is a song played from
// Liked Songs: then the sequence is the Liked Songs list, from that song on.

/** Rows of what is still to play that are drawn at most (the list can have hundreds of cards). */
export const QUEUE_MAX_NEXT = 100;

/** Where an album starts: the track the artist highlights on Bandcamp, or the first one when none is set. */
export const startingTrack = (tracks) => Math.max(0, tracks.findIndex((track) => track.featured));

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
 * The queue. `context` is 'list' (the cards) or 'liked' (a song was played from Liked Songs).
 *  - `order`: ids of the cards, in the order of the page; `cursorId`: the card where the list goes on from;
 *  - `current`: { id, index, title } of the song that plays (id null when nothing does);
 *  - `songOf(id)`: { i, title } of the song a card is for, or null when it is not known;
 *  - `liked`: the Liked Songs, in the order of their list: { id, i, title }.
 * A row is { id, i, title, track: true, sec: 'played' | 'now' | 'next' }, plus `liked: true` for the rows that go on in Liked Songs; a card
 * whose song is not known is { id, i: -1, placeholder: true, sec: 'next' } (the page names it by its album).
 * Returns { rows, more, total, played }: `more` is true when cards are left out of the rows; `played` is how far the list has gone.
 */
export function playbackQueue({ context = 'list', order, cursorId, current, history, songOf, liked = [] }) {
  const rows = [];
  for (const h of playedSongs(history, current)) rows.push({ id: h.id, i: h.index, title: h.title || `Track ${h.index + 1}`, track: true, sec: 'played' });
  if (current.id) rows.push({ id: current.id, i: current.index, title: current.title || `Track ${current.index + 1}`, track: true, sec: 'now' });

  const cursor = order.indexOf(cursorId);
  let next = [];
  if (context === 'liked') {
    const at = liked.findIndex((song) => song.id === current.id && song.i === current.index);
    next = liked.slice(at + 1).map((song) => ({ id: song.id, i: song.i, title: song.title || `Track ${song.i + 1}`, track: true, sec: 'next', liked: true }));
  } else {
    next = order.slice(cursor + 1).filter((id) => id !== current.id).map((id) => {
      const song = songOf(id);
      return song && song.title ? { id, i: song.i, title: song.title, track: true, sec: 'next' } : { id, i: -1, placeholder: true, sec: 'next' };
    });
  }
  rows.push(...next.slice(0, QUEUE_MAX_NEXT));
  return { rows, more: next.length > QUEUE_MAX_NEXT, total: context === 'liked' ? liked.length : order.length, played: Math.max(0, cursor + 1) };
}
