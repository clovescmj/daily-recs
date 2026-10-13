import { PROJECT_NAME, reportBugUrl, supportUrl } from '../../lib/config.js';
import { summary } from '../../lib/taste-sync.js';

const $ = (id) => document.getElementById(id);

$('version').textContent = chrome.runtime.getManifest().version;
$('feedback-link').href = supportUrl(chrome.runtime.id);
$('bug-link').href = reportBugUrl(chrome.runtime.getManifest().version, navigator.userAgent);
document.querySelectorAll('[data-name]').forEach((el) => { el.textContent = PROJECT_NAME; });

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The box under "Sync": what the Google account holds, and when it last changed. */
async function showSyncSummary() {
  const value = $('sync');
  const when = $('sync-when');
  when.textContent = '';
  try {
    const s = await summary(chrome.storage.sync);
    if (!s) { value.textContent = 'Nothing saved yet'; return; }
    value.textContent = plural(s.dislikes, 'hidden album');
    if (s.updatedAt) when.textContent = `Last update: ${new Date(s.updatedAt).toLocaleString()}`;
  } catch {
    value.textContent = "Couldn't read your synced data";
  }
}

showSyncSummary();

// Clear saved data: the local copy first (so the sync that follows has nothing to send back), then the part kept in the Google account.
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
