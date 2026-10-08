// Commands sent by the player bar in the Bandcamp tab (postMessage), after validation.
import { session } from './session.js';
import * as player from './player.js';
import { dislikeAlbum, setSave, setWish, undoDislike } from './wishlist-actions.js';

const isFraction = (v) => typeof v === 'number' && Number.isFinite(v);
const isAlbumId = (v) => (typeof v === 'string' || typeof v === 'number') && /^\d+$/.test(String(v));

const isTrack = (v) => Boolean(v) && typeof v === 'object' && isAlbumId(v.id) && Number.isInteger(v.i) && v.i >= 0 && v.i < 1000;
const targetId = (v) => (isAlbumId(v) ? String(v) : (player.currentAlbum() || {}).id);

const COMMANDS = {
  toggle: () => player.togglePlay(),
  prev: () => player.previousTrack(),
  next: () => player.nextTrack(),
  skip: () => player.skipAlbum(),
  pause: () => player.pause(),
  shuf: () => player.toggleShuffle(),
  mute: () => player.toggleMute(),
  seek: (v) => isFraction(v) && player.seekTo(Math.max(0, Math.min(1, v))),
  seekBy: (v) => isFraction(v) && player.seekBy(Math.max(-60, Math.min(60, v))),
  vol: (v) => isFraction(v) && player.setVolume(v),
  playAlbum: (v) => isAlbumId(v) && player.playAlbum(String(v)),
  // the heart and the thumb down act on the album named in the command (the queue's items), or on the one that is playing
  wish: (v) => { const id = targetId(v); return id && setWish(id, !session.wished.has(id)); },
  // the + : the track that is playing, or the one named in the command (from the Liked list)
  save: (v) => { const track = isTrack(v) ? v : player.currentTrack(); return track && setSave(track, !session.saved.has(`${track.id}:${track.i}`)); },
  playTrack: (v) => isTrack(v) && player.playSavedTrack(String(v.id), v.i),
  dislike: (v) => {
    const id = targetId(v);
    if (!id) return undefined;
    return session.dislikedThisVisit.has(id) ? undoDislike(id) : dislikeAlbum(id);
  },
};

export function runCommand(name, value) {
  if (Object.hasOwn(COMMANDS, name)) COMMANDS[name](value);
}
