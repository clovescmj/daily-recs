// Runs INSIDE the user's Bandcamp profile page (the page's own JavaScript world), injected by the service worker with
// chrome.scripting.executeScript({ world: 'MAIN', func }). Because it is serialised and executed in the page, it must be
// fully self-contained: it can only use page globals (Fanpage, CurrentFan, document), never imports or closures.
//
// It uses Bandcamp's own functions, which take care of the security token (crumb) and the request:
//   Fanpage.collectItem(itemId, itemType, bandId, key, element)    -> add to wishlist
//   Fanpage.uncollectItem(itemId, element, removeControls)         -> remove from wishlist
// Success is confirmed through CurrentFan.collection_count, which Bandcamp only changes after the server responds.
export function wishlistOpInPage({ op, id, bandId, timeoutMs = 6000 }) {
  const POLL_INTERVAL_MS = 100;
  return new Promise((resolve) => {
    try {
      if (typeof Fanpage === 'undefined' || typeof CurrentFan === 'undefined' || !CurrentFan || CurrentFan.fan_id == null) {
        return resolve({ ok: false, error: 'not on your Bandcamp profile page' });
      }
      const before = CurrentFan.collection_count;
      if (typeof before !== 'number') return resolve({ ok: false, error: "can't verify the result" });
      const element = document.createElement('div'); // Bandcamp only uses it to update its own interface
      try {
        if (op === 'add') Fanpage.collectItem(id, 'album', bandId, `a${id}`, element);
        else Fanpage.uncollectItem(id, element, false);
      } catch { /* the request already left; errors after it (onboarding tooltips) don't matter: the counter decides */ }
      const startedAt = Date.now();
      const check = () => {
        const now = CurrentFan.collection_count;
        if (op === 'add' ? now > before : now < before) return resolve({ ok: true });
        if (Date.now() - startedAt > timeoutMs) return resolve({ ok: false, error: 'no confirmation from Bandcamp' });
        setTimeout(check, POLL_INTERVAL_MS);
      };
      check();
    } catch (error) {
      resolve({ ok: false, error: String((error && error.message) || error) });
    }
  });
}
