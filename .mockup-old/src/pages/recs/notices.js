// The notice of what is new: when the last block of What's new is not the one the user closed, the page of the Bandcamp tab shows it in a small
// window (bottom right, above the player). The window is drawn by the content script (src/content/notice.js); it is told through postMessage.
import { latestNews, newsAction } from '../../lib/news.js';
import { NEWS_SEEN_KEY, STATE_KEY, WHATS_NEW_KEY } from '../../lib/storage-keys.js';
import { postToHost } from './host-bridge.js';

export async function showNewsIfNew() {
  try {
    const response = await fetch(chrome.runtime.getURL('src/pages/about/whats-new.html'));
    const news = latestNews(await response.text());
    if (!news) return;
    const stored = await chrome.storage.local.get([NEWS_SEEN_KEY, STATE_KEY]);
    const action = newsAction({ title: news.title, seen: stored[NEWS_SEEN_KEY], hasLibrary: Boolean(stored[STATE_KEY] && stored[STATE_KEY].owned) });
    if (action === 'none') await chrome.storage.local.remove(WHATS_NEW_KEY);   // already seen: the dot on the icon has nothing to point to
    if (action === 'mark') await chrome.storage.local.set({ [NEWS_SEEN_KEY]: news.title });
    if (action === 'show') postToHost({ dr: 'notice', kind: 'news', key: news.title, title: news.title });
  } catch { /* the notice is a courtesy: the page works without it */ }
}
