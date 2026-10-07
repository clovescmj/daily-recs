// Shuffle that plays EVERY track of EVERY listed album once, in random order, before anything repeats (then starts over).
// Track lists are only known once an album page has been read, and reading all of them up front would be a burst of
// requests, so albums are read as they come up: an album that hasn't been read yet is assumed to have a typical number of
// tracks when deciding how likely it is to come up next. Plain data and Math.random only, so it is easy to test.
export const ASSUMED_TRACKS = 8;

export function createShuffler(random = Math.random) {
  const counts = new Map();   // album id -> number of tracks (known after the album was read)
  const played = new Map();   // album id -> Set of played track indexes

  const playedOf = (id) => played.get(id) || new Set();
  const remaining = (id) => Math.max(0, (counts.get(id) ?? ASSUMED_TRACKS) - playedOf(id).size);

  return {
    /** Tells the shuffler how many tracks an album really has. */
    setTrackCount(id, count) { counts.set(id, count); },

    /** Marks a track as played (also used for the track that was already playing when shuffle was switched on). */
    markPlayed(id, index) {
      if (!played.has(id)) played.set(id, new Set());
      played.get(id).add(index);
    },

    /** Random album among `ids`, more likely the more unplayed tracks it has. Starts a new round when everything was played. */
    pickAlbum(ids) {
      const choose = () => {
        const weights = ids.map(remaining);
        const total = weights.reduce((sum, w) => sum + w, 0);
        if (!total) return null;
        let ticket = random() * total;
        for (let i = 0; i < ids.length; i++) { ticket -= weights[i]; if (ticket < 0) return ids[i]; }
        return ids[ids.length - 1];
      };
      let id = choose();
      if (id === null && ids.length) { played.clear(); id = choose(); } // everything was played: new round
      return id;
    },

    /** Random unplayed track index of an album, or null when all of its tracks were played. */
    pickTrack(id, trackCount) {
      const done = playedOf(id);
      const open = Array.from({ length: trackCount }, (_, i) => i).filter((i) => !done.has(i));
      return open.length ? open[Math.floor(random() * open.length)] : null;
    },

    reset() { played.clear(); },
  };
}
