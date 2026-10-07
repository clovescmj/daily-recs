// Extension-wide configuration.
export const PROJECT_NAME = 'Daily Recs';

/**
 * Page of this extension in the Chrome Web Store. `tab` is "support" (questions, bugs, ideas), "reviews" or omitted.
 * The store accepts the extension id alone and redirects to the full address, and an extension installed from the
 * store has the store's id as `chrome.runtime.id`, so nothing needs to be configured. (Unpacked copies get a 404.)
 */
export const storeUrl = (extensionId, tab = '') => `https://chromewebstore.google.com/detail/${extensionId}${tab ? `/${tab}` : ''}`;

export const REPO_URL = 'https://github.com/clovescmj/daily-recs';

/** "Report a bug": a new GitHub issue with the version and browser already filled in (nothing personal). */
export function reportBugUrl(version, userAgent = '') {
  const body = ['**What happened?**', '', '', '**What did you expect?**', '', '', '---', `Daily Recs v${version}`, userAgent].join('\n');
  const params = new URLSearchParams({ title: '', body, labels: 'bug' });
  return `${REPO_URL}/issues/new?${params}`;
}

export const supportUrl = (extensionId) => storeUrl(extensionId, 'support');
