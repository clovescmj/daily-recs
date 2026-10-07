import { postToHost } from './host-bridge.js';

/** Shows a short notice in the Bandcamp page, above the player bar (this page lives in an iframe inside it). */
export function toast(message) {
  postToHost({ dr: 'toast', msg: message });
}
