// A tab left open past midnight: it keeps the list it has, and a notice at the bottom of the Bandcamp page says that a new day started. The user decides when to
// get the new recommendations; the same list (Best matches, Surprise me or the same genres) is then asked for today.
import { msUntilTomorrow, todayKey } from '../../lib/state.js';
import { postToHost } from './host-bridge.js';
import { session } from './session.js';

const RECHECK_MS = 5 * 60 * 1000;   // (timers of a tab in the background are late: coming back to the tab is the main trigger)

/** `showNewList(view, keys)` asks for today's list of the same kind the user was in. */
let getNewRecs = () => {};

/** The button of the notice was pressed (the notice lives in the Bandcamp page and sends it as a command). */
export const newDayAccepted = () => getNewRecs();

export function initNewDay(showNewList) {
  session.loadedDay = todayKey();

  const check = () => {
    if (todayKey() === session.loadedDay) return;
    if (session.landing) { session.loadedDay = todayKey(); return; }   // the opening screen is the start of the day anyway
    if (session.newDay) return;
    session.newDay = true;
    postToHost({ dr: 'notice', kind: 'newday' });
  };

  getNewRecs = () => {
    if (!session.newDay) return;
    session.newDay = false;
    session.loadedDay = todayKey();
    showNewList(session.view, session.tagKeys);
  };

  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  addEventListener('focus', check);
  setInterval(check, RECHECK_MS);
  const atMidnight = () => setTimeout(() => { check(); atMidnight(); }, msUntilTomorrow() + 1000);
  atMidnight();
}
