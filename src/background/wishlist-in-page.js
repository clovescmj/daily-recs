// Runs INSIDE the user's Bandcamp profile page (the page's own JavaScript world), injected by the service worker with
// chrome.scripting.executeScript({ world: 'MAIN', func }). Because it is serialised and executed in the page, it must be
// fully self-contained: it can only use page globals (Crumb, CurrentFan, Fanpage, document), never imports or closures.
//
// The request is the one Bandcamp's own wishlist button makes ("/collect_item_cb" and "/uncollect_item_cb"), sent through Bandcamp's
// own `Crumb.ajax`, which takes care of the security token (it asks again by itself when the token is old), but with our own
// callbacks: the answer says if it worked, and Bandcamp's error dialog does not open when it did not.
// Without `Crumb` (a page that changed), it falls back to Bandcamp's own functions and confirms through CurrentFan.collection_count,
// which Bandcamp only changes after the server responds:
//   Fanpage.collectItem(itemId, itemType, bandId, key, element)    -> add to wishlist
//   Fanpage.uncollectItem(itemId, element, removeControls)         -> remove from wishlist
export function wishlistOpInPage({ op, id, bandId, timeoutMs = 8000 }) {
  const POLL_INTERVAL_MS = 100;
  return new Promise((resolve) => {
    /** Bandcamp's own functions, confirmed through the counter of the menu. */
    function viaPageFunction() {
      if (typeof Fanpage === 'undefined') {
        return resolve({ ok: false, error: 'not on your Bandcamp profile page' });
      }
      const before = CurrentFan.collection_count;
      if (typeof before !== 'number') return resolve({ ok: false, error: "can't verify the result" });
      const element = typeof document !== 'undefined' ? document.createElement('div') : {}; // Bandcamp only uses it to update its own interface
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
    }

    try {
      if (typeof CurrentFan === 'undefined' || !CurrentFan || CurrentFan.fan_id == null) {
        return resolve({ ok: false, error: 'not on your Bandcamp profile page' });
      }
      if (typeof Crumb !== 'undefined' && Crumb && typeof Crumb.ajax === 'function') {
        const data = { fan_id: CurrentFan.fan_id, item_id: id };
        if (op === 'add') {
          data.item_type = 'a';   // "a" is what the wishlist button of a profile sends for an album
          data.band_id = bandId;
          if (!CurrentFan.is_own_collection && typeof FanData !== 'undefined' && FanData) data.ref_username = FanData.username;
        }
        let finished = false;
        let timer = null;
        const finish = (result) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          resolve(result);
        };
        // If the request does not work, Bandcamp's own function is tried once, as before: the heart still does what it did.
        const retryWithPageFunction = (error) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          if (typeof Fanpage === 'undefined') return resolve({ ok: false, error });
          return viaPageFunction();
        };
        timer = setTimeout(() => finish({ ok: false, error: 'no answer from Bandcamp' }), timeoutMs);
        Crumb.ajax({
          url: op === 'add' ? '/collect_item_cb' : '/uncollect_item_cb',
          data,
          type: 'POST',
          dataType: 'json',
          xhrFields: { withCredentials: true },
          success(response) {
            if (response && response.error === true) return retryWithPageFunction(String(response.exception || 'Bandcamp could not do it').slice(0, 120));
            try { // what Bandcamp's own button does after it worked: the count of the menu follows
              if (typeof CurrentFan.collection_count === 'number') {
                CurrentFan.collection_count += op === 'add' ? 1 : -1;
                if (typeof $ === 'function') $('#menubar-collection-count').html(CurrentFan.collection_count);
              }
            } catch { /* the count on the menu is only decoration */ }
            return finish({ ok: true });
          },
          error(xhr) {
            retryWithPageFunction(`Bandcamp answered ${xhr && xhr.status ? xhr.status : 'with an error'}`);
          },
        });
        return;
      }
      return viaPageFunction();
    } catch (error) {
      resolve({ ok: false, error: String((error && error.message) || error) });
    }
  });
}
