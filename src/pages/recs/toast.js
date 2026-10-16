import { postToHost } from './host-bridge.js';

const UNDO_MS = 15_000;   // how long an Undo can be asked for (the confirmation itself goes away in a few seconds)
const undos = new Map();
let nextToken = 0;

/**
 * Shows a short confirmation in the Bandcamp page, above the player bar (this page lives in an iframe inside it). With `undo`, the
 * confirmation has an Undo button that runs it.
 */
export function toast(message, undo = null) {
  if (!undo) { postToHost({ dr: 'toast', msg: message }); return; }
  nextToken += 1;
  const token = nextToken;
  undos.set(token, undo);
  setTimeout(() => undos.delete(token), UNDO_MS);
  postToHost({ dr: 'toast', msg: message, undo: token });
}

/** The Undo of a confirmation was pressed. */
export function runUndo(token) {
  const undo = undos.get(token);
  if (!undo) return;
  undos.delete(token);
  undo();
}
