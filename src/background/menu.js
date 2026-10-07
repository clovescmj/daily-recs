// Right-click menu on the toolbar icon. A plain click opens the main page (see service-worker.js).
import { reportBugUrl, supportUrl } from '../lib/config.js';
import { updateBadge } from './jobs.js';
import { openExtensionPage, openMainPage } from './navigation.js';

const PAGES = Object.freeze({
  about: 'src/pages/about/about.html',
});

/** Menu items are created on install/update; clicks are handled on every worker start (listeners must be top-level). */
export function registerMenu() {
  chrome.runtime.onInstalled.addListener(() => {
    const version = chrome.runtime.getManifest().version;
    chrome.contextMenus.removeAll(() => {
      const item = (id, title) => chrome.contextMenus.create({ id, title, contexts: ['action'] });
      chrome.contextMenus.create({ id: 'count', title: 'Loading…', enabled: false, contexts: ['action'] });
      chrome.contextMenus.create({ id: 'separator', type: 'separator', contexts: ['action'] });
      item('open', 'Open Daily Recs');
      item('feedback', 'Feedback');
      item('bug', 'Report a bug');
      item('about', `About · v${version}`);
      updateBadge(); // fills in the number text (created after the items, so the update finds it)
    });
  });
  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === 'open') return openMainPage();
    if (info.menuItemId === 'bug') return chrome.tabs.create({ url: reportBugUrl(chrome.runtime.getManifest().version) });
    if (info.menuItemId === 'feedback') return chrome.tabs.create({ url: supportUrl(chrome.runtime.id) });
    if (PAGES[info.menuItemId]) return openExtensionPage(PAGES[info.menuItemId]);
  });
}
