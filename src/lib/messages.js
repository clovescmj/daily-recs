// Message protocol between the extension's pages / content script and the service worker.
// Every message is validated and normalised here before it is acted upon (the sender is checked in the service worker).
import { toNumericId } from './bandcamp.js';

export const MSG = Object.freeze({
  REFRESH: 'refresh',
  FEEDBACK: 'feedback',
  WISHLIST_OP: 'wishlist-op',        // content script -> runs Bandcamp's own wishlist function inside the profile tab
  WISHLIST_QUEUE: 'wishlist-queue',  // remember an operation for later (a failure)
  WISHLIST_DONE: 'wishlist-done',
  MARK_OPENED: 'mark-opened',
  COLOR_SCHEME: 'color-scheme',      // { dark } reported by a page, to pick the toolbar icon that suits the theme
  OPEN_MAIN: 'open-main',            // open the daily recs tab (asks to sign in first when needed)
});

export const FEEDBACK_KINDS = Object.freeze(['like', 'unlike', 'dislike', 'undislike']);
export const WISHLIST_OPS = Object.freeze(['add', 'remove']);

/** Returns the normalised message, or null if it isn't a well-formed message of ours. */
export function parseMessage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = toNumericId(raw.id);
  switch (raw.type) {
    case MSG.REFRESH:
      return { type: raw.type, force: raw.force === true, mode: raw.mode === 'surprise' ? 'surprise' : 'best' };
    case MSG.COLOR_SCHEME:
      return { type: raw.type, dark: raw.dark === true };
    case MSG.OPEN_MAIN:
      return { type: raw.type };
    case MSG.FEEDBACK:
      return id && FEEDBACK_KINDS.includes(raw.kind) ? { type: raw.type, id, kind: raw.kind } : null;
    case MSG.WISHLIST_OP:
    case MSG.WISHLIST_QUEUE: {
      const bandId = toNumericId(raw.bandId);
      return id && bandId && WISHLIST_OPS.includes(raw.op) ? { type: raw.type, op: raw.op, id, bandId } : null;
    }
    case MSG.WISHLIST_DONE:
    case MSG.MARK_OPENED:
      return id ? { type: raw.type, id } : null;
    default:
      return null;
  }
}
