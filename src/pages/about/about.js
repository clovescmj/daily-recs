import { PROJECT_NAME, reportBugUrl, supportUrl } from '../../lib/config.js';
import { summary } from '../../lib/taste-sync.js';

document.getElementById('version').textContent = chrome.runtime.getManifest().version;
document.getElementById('feedback-link').href = supportUrl(chrome.runtime.id);
document.getElementById('bug-link').href = reportBugUrl(chrome.runtime.getManifest().version, navigator.userAgent);
document.querySelectorAll('[data-name]').forEach((el) => { el.textContent = PROJECT_NAME; });

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

async function showSyncSummary() {
  const el = document.getElementById('sync');
  try {
    const s = await summary(chrome.storage.sync);
    if (!s) { el.textContent = 'Nothing saved to your account yet.'; return; }
    const when = s.updatedAt ? ` Last update: ${new Date(s.updatedAt).toLocaleString()}.` : '';
    el.textContent = `Saved to your account: ${plural(s.likes, 'like')}, ${plural(s.dislikes, 'dislike')}.${when}`;
  } catch {
    el.textContent = "Couldn't read your synced data.";
  }
}

showSyncSummary();
