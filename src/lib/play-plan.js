// What plays next in Shuffle (one song of each album, in a random order); the same walk in the order of the list is mode 'one' (not offered by the player).
// A song plays once: it is marked when it starts, and an album with no unplayed song left is skipped. The list is walked in rounds, one song
// per album in each round; when a round ends the next one starts over, until every song of every album has played.

/** The first time an album plays it starts with the track the artist highlights; later ones are drawn from the songs that have not played. */
export function createPlayPlan(random = Math.random) {
  const played = new Map();   // album id -> Set of track numbers that have played
  const counts = new Map();   // album id -> how many tracks it has (known once it was opened)
  let round = [];             // shuffle: the albums of the current round, in order

  const playedOf = (id) => played.get(id) || new Set();
  const done = (id) => counts.has(id) && playedOf(id).size >= counts.get(id);
  const shuffled = (ids) => {
    const list = [...ids];
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };

  return {
    /** A song starts: it will not play again. */
    mark(id, index, trackCount) {
      if (!played.has(id)) played.set(id, new Set());
      played.get(id).add(index);
      counts.set(id, trackCount);
    },

    /** The track an album plays now: `featured` the first time, a random unplayed one after that, or -1 when all have played. */
    pick(id, trackCount, featured) {
      const before = playedOf(id);
      if (!before.size) return featured;
      const left = [];
      for (let i = 0; i < trackCount; i += 1) if (!before.has(i)) left.push(i);
      return left.length ? left[Math.floor(random() * left.length)] : -1;
    },

    /** The albums in the order of the current round: the list itself, or (shuffle) a random order kept until the round is over. */
    order(mode, ids) {
      if (mode !== 'shuffle') return ids;
      const known = new Set(ids);
      round = round.filter((id) => known.has(id));
      if (!round.length) round = shuffled(ids.filter((id) => !done(id)));
      const inRound = new Set(round);
      for (const id of ids) if (!inRound.has(id)) round.push(id); // an album that arrived meanwhile goes to the end
      return round;
    },

    /** True while some song of the list has not played. */
    hasMore: (ids) => ids.some((id) => !done(id)),

    /** The album after `currentId` (starting a new round at the end of one), or null when every song has played. */
    next(mode, ids, currentId) {
      if (!this.hasMore(ids)) return null;
      const order = this.order(mode, ids);
      const at = order.indexOf(currentId);
      for (let i = at + 1; i < order.length; i += 1) if (!done(order[i])) return order[i];
      // the round is over: a new one, with the albums that still have songs
      if (mode === 'shuffle') {
        round = shuffled(ids.filter((id) => !done(id)));
        if (round.length > 1 && round[0] === currentId) round.push(round.shift()); // not the same album twice in a row
        return round[0];
      }
      return order.find((id) => !done(id)) || null;
    },

    /** Everything is new again (the user played the list once through and wants it again). */
    reset() { played.clear(); round = []; },
  };
}
