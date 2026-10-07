// Receives messages from the extension's pages and the content script, checks who sent them and what they say, and
// dispatches to the jobs. Following Chrome's guidance, the sender is validated and every payload is parsed strictly.
import { MSG, parseMessage } from '../lib/messages.js';
import { wishlistOpInPage } from './wishlist-in-page.js';
import * as defaultJobs from './jobs.js';
import { setColorScheme } from './icon.js';
import { openMainPage } from './navigation.js';

const PROFILE_ORIGIN_PREFIX = 'https://bandcamp.com/';

/**
 * Builds the handler with its dependencies injected (so it can be tested without Chrome).
 *   extensionId / extensionUrl: identity of this extension (`chrome.runtime.id`, `chrome.runtime.getURL('')`)
 *   runInPage(tabId, op):       executes the wishlist operation inside that Bandcamp tab
 */
export function createMessageHandler({ extensionId, extensionUrl, runInPage, jobs = defaultJobs, openMain = openMainPage, setScheme = setColorScheme }) {
  const fromExtensionPage = (sender) => sender?.id === extensionId && typeof sender.url === 'string' && sender.url.startsWith(extensionUrl);
  const fromProfileTab = (sender) => sender?.id === extensionId && sender.tab?.id != null
    && typeof sender.url === 'string' && sender.url.startsWith(PROFILE_ORIGIN_PREFIX);

  return async function handleMessage(raw, sender) {
    const message = parseMessage(raw);
    if (!message) return { ok: false, error: 'invalid message' };
    // Only the content script (on bandcamp.com) may ask to run code in a Bandcamp tab; everything else comes from our pages.
    const allowed = message.type === MSG.WISHLIST_OP ? fromProfileTab(sender)
      : message.type === MSG.COLOR_SCHEME ? fromProfileTab(sender) || fromExtensionPage(sender)
      : fromExtensionPage(sender);
    if (!allowed) return { ok: false, error: 'sender not allowed' };

    switch (message.type) {
      case MSG.REFRESH: await jobs.runRefresh(message); break;
      case MSG.FEEDBACK: await jobs.runFeedback(message); break;
      case MSG.WISHLIST_QUEUE: await jobs.runWishlistQueue(message); break;
      case MSG.WISHLIST_DONE: await jobs.runWishlistDone(message.id); break;
      case MSG.OPEN_MAIN: await openMain(); break;
      case MSG.COLOR_SCHEME: await setScheme(message.dark); break;
      case MSG.MARK_OPENED: await jobs.runMarkOpened(message.id); break;
      case MSG.WISHLIST_OP: return runInPage(sender.tab.id, message);
      default: return { ok: false, error: 'unknown message' };
    }
    return { ok: true };
  };
}

async function runWishlistInPage(tabId, { op, id, bandId }) {
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId }, world: 'MAIN', func: wishlistOpInPage, args: [{ op, id, bandId }],
    });
    return (injection && injection.result) || { ok: false, error: 'no result' };
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error) };
  }
}

export function registerMessageHandler() {
  const handle = createMessageHandler({
    extensionId: chrome.runtime.id,
    extensionUrl: chrome.runtime.getURL(''),
    runInPage: runWishlistInPage,
  });
  chrome.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    // Always answer, even on failure, so the caller never waits on a closed port.
    handle(raw, sender).then(sendResponse, (error) => sendResponse({ ok: false, error: String((error && error.message) || error) }));
    return true; // keep the channel open for the async response
  });
}
