// Commands sent by the player bar in the Bandcamp tab (postMessage), after validation.
import { session } from './session.js';
import * as player from './player.js';
import { dislikeAlbum, setLike, undoDislike } from './wishlist-actions.js';

const isFraction = (v) => typeof v === 'number' && Number.isFinite(v);
const isAlbumId = (v) => (typeof v === 'string' || typeof v === 'number') && /^\d+$/.test(String(v));

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
  like: () => { const album = player.currentAlbum(); return album && setLike(album.id, !session.liked.has(album.id)); },
  dislike: () => {
    const album = player.currentAlbum();
    if (!album) return undefined;
    return session.dislikedThisVisit.has(album.id) ? undoDislike(album.id) : dislikeAlbum(album.id);
  },
};

export function runCommand(name, value) {
  if (Object.hasOwn(COMMANDS, name)) COMMANDS[name](value);
}
