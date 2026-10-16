// Cards of lists that an older version made do not know their song yet (it is saved with the genres of an album). The page asks the service
// worker to read them, a few at a time and in the order of the page; the cards are drawn again as the songs arrive (see render.js).
import { MAX_FILL_SONGS, MSG } from '../../lib/messages.js';
import { send } from './data.js';
import { visibleCardIds } from './cards.js';
import { session } from './session.js';

let filling = false;
let pausedUntil = 0;
const RETRY_MS = 5 * 60 * 1000;

/** The ids of the cards on the page, in order, whose song is not known (null means it was looked for and there is none). */
const missing = () => {
  const pool = (session.state && session.state.pool) || {};
  return visibleCardIds().filter((id) => pool[id] && pool[id].song === undefined);
};

export async function fillMissingSongs() {
  if (filling || Date.now() < pausedUntil || session.pending || session.landing) return;
  if (!missing().length) return;
  filling = true;
  try {
    for (let round = 0; round < 40; round += 1) {
      const ids = missing().slice(0, MAX_FILL_SONGS);
      if (!ids.length) break;
      const reply = await send({ type: MSG.FILL_SONGS, ids });
      if (!reply || !reply.ok || !reply.filled) { pausedUntil = Date.now() + RETRY_MS; break; }   // (nothing read: not asked again for a while)
      await new Promise((resolve) => setTimeout(resolve, 300));   // (the page takes the new songs from the storage)
    }
  } catch {
    pausedUntil = Date.now() + RETRY_MS;
  } finally {
    filling = false;
  }
}
