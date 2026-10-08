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
  EXTEND_LIST: 'extend-list',        // one more album at the end of a list (when the user hides one)
  COLOR_SCHEME: 'color-scheme',      // { dark } reported by a page, to pick the toolbar icon that suits the theme
  OPEN_MAIN: 'open-main',            // open the daily recs tab (asks to sign in first when needed)
});

export const FEEDBACK_KINDS = Object.freeze(['like', 'unlike', 'dislike', 'undislike', 'wish', 'unwish', 'save', 'unsave']);
export const WISHLIST_OPS = Object.freeze(['add', 'remove']);

/** Returns the normalised message, or null if it isn't a well-formed message of ours. */
export function parseMessage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = toNumericId(raw.id);
  switch (raw.type) {
    case MSG.REFRESH:
      return {
        type: raw.type, force: raw.force === true, mode: ['surprise', 'tags'].includes(raw.mode) ? raw.mode : 'best',
        tags: Array.isArray(raw.tags) ? raw.tags.filter((tag) => typeof tag === 'string' && /^[\p{L}\p{N}]{1,40}$/u.test(tag)).slice(0, 5) : [],
      };
    case MSG.EXTEND_LIST:
      return {
        type: raw.type, view: ['surprise', 'tags'].includes(raw.view) ? raw.view : 'best',
        tags: Array.isArray(raw.tags) ? raw.tags.filter((tag) => typeof tag === 'string' && /^[\p{L}\p{N}]{1,40}$/u.test(tag)).slice(0, 5) : [],
      };
    case MSG.COLOR_SCHEME:
      return { type: raw.type, dark: raw.dark === true };
    case MSG.OPEN_MAIN:
      return { type: raw.type };
    case MSG.FEEDBACK:
    {
      if (!id || !FEEDBACK_KINDS.includes(raw.kind)) return null;
      // a dislike made inside a genre list says which genres were selected: it is then scoped to them
      const tags = Array.isArray(raw.tags) ? raw.tags.filter((tag) => typeof tag === 'string' && /^[\p{L}\p{N}]{1,40}$/u.test(tag)).slice(0, 5) : [];
      if (raw.kind === 'save' || raw.kind === 'unsave') { // the Liked list holds tracks: which one of the album
        const index = Number.isInteger(raw.index) && raw.index >= 0 && raw.index < 1000 ? raw.index : -1;
        const track = typeof raw.track === 'string' ? raw.track.replace(/[\u0000-\u001f]/g, ' ').slice(0, 200) : '';
        return index < 0 ? null : { type: raw.type, id, kind: raw.kind, index, track };
      }
      return tags.length ? { type: raw.type, id, kind: raw.kind, tags } : { type: raw.type, id, kind: raw.kind };
    }
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
