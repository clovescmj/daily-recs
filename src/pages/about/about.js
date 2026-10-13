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
    el.textContent = `Saved to your account: ${plural(s.dislikes, 'hidden album')}.${when}`;
  } catch {
    el.textContent = "Couldn't read your synced data.";
  }
}

showSyncSummary();

// Clear saved data: the local copy first (so the sync that follows has nothing to send back), then the part kept in the Google account.
const $ = (id) => document.getElementById(id);
function showClearStep(step) {
  $('clear-data').hidden = step !== 'ask';
  $('clear-confirm').hidden = step !== 'confirm';
}
$('clear-data').addEventListener('click', () => { $('clear-done').textContent = ''; showClearStep('confirm'); });
$('clear-no').addEventListener('click', () => showClearStep('ask'));
$('clear-yes').addEventListener('click', async () => {
  try {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    await chrome.storage.session.clear();
    try { localStorage.clear(); } catch { /* storage unavailable */ }
    $('clear-done').textContent = 'Saved data cleared. Open Daily Recs again to start fresh.';
  } catch {
    $('clear-done').textContent = "Couldn't clear everything. Try again.";
  }
  showClearStep('ask');
  showSyncSummary();
});
