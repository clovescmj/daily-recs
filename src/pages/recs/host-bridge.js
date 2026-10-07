// Link between this page (iframe inside the Bandcamp profile tab) and the content script of that tab.
// Messages are plain objects tagged with `dr`; origin and source are always checked on receipt.
import { HOST_ORIGIN } from './session.js';

const WISHLIST_TIMEOUT_MS = 12000;
const pendingWishlistOps = new Map(); // request id -> resolve
let nextRequestId = 0;

export function postToHost(message) {
  parent.postMessage(message, HOST_ORIGIN);
}

/** Asks the Bandcamp page (via the service worker) to add/remove an album. */
export function requestWishlistOp(op, { id, artistId }) {
  return new Promise((resolve) => {
    const rid = ++nextRequestId;
    const timer = setTimeout(() => { pendingWishlistOps.delete(rid); resolve({ ok: false, error: 'timeout' }); }, WISHLIST_TIMEOUT_MS);
    pendingWishlistOps.set(rid, (result) => { clearTimeout(timer); resolve(result); });
    postToHost({ dr: 'wish', rid, op, id, bandId: artistId });
  });
}

/** Starts listening to the host page. `onCommand(cmd, value)` runs the player commands sent by its player bar. */
export function listenToHost(onCommand) {
  const postHeight = () => postToHost({ dr: 'height', h: Math.ceil(document.body.getBoundingClientRect().height) });
  new ResizeObserver(postHeight).observe(document.body);
  postHeight();

  addEventListener('message', (event) => {
    const message = event.data;
    if (event.origin !== HOST_ORIGIN || event.source !== parent || !message || typeof message !== 'object') return;
    if (message.dr === 'wishResult') {
      const resolve = pendingWishlistOps.get(message.rid);
      if (resolve) { pendingWishlistOps.delete(message.rid); resolve({ ok: message.ok === true, error: message.error }); }
    } else if (message.dr === 'cmd' && typeof message.cmd === 'string') {
      onCommand(message.cmd, message.v);
    }
  });
}
