import { postToHost } from './host-bridge.js';

/** Shows a short confirmation in the Bandcamp page, above the player bar (this page lives in an iframe inside it). To undo it, the icon is pressed again. */
export function toast(message) {
  postToHost({ dr: 'toast', msg: message });
}
