// A record, on this computer, of what the user did with the albums of the lists (hid, wishlisted, liked a song), with how much evidence the
// album had. It says which kind of album gets hidden, so the lists can be tuned. It is never sent anywhere.

export const MAX_DECISIONS = 1000;
const KINDS = Object.freeze({ dislike: 'hide', undislike: 'unhide', wish: 'wish', unwish: 'unwish', save: 'save' });

/** What is known about an album at the moment of a decision: how much evidence there was for it, and where it came from. */
export function describeCandidate(candidate, fit = null) {
  const srcs = (candidate && candidate.srcs) || {};
  const fans = Object.values(srcs).filter((n) => Number.isFinite(n));
  return {
    sources: Object.keys(srcs).length,
    fans: fans.length ? Math.max(...fans) : 0,
    tags: ((candidate && candidate.tags) || []).slice(0, 3),
    fit: fit === null || fit === undefined ? null : Math.round(fit * 100) / 100,
    hop: Boolean(candidate && candidate.hop),
    surprise: Boolean(candidate && candidate.surprise),
  };
}

/** One entry for the record, or null for a kind that is not recorded. */
export function decisionEntry({ id, kind, view = 'best', candidate = null, fit = null, now = Date.now() }) {
  const action = KINDS[kind];
  if (!action || !id) return null;
  return { at: now, id: String(id), action, view, ...describeCandidate(candidate, fit) };
}

/** The record with `entry` added, keeping the latest MAX_DECISIONS. */
export function addDecision(list, entry) {
  if (!entry) return list || [];
  return [...(list || []), entry].slice(-MAX_DECISIONS);
}
