// Export of the Liked Songs: a CSV file built here (the page of the extension) and saved by the browser as a download.
import { likedCsv, likedCsvName } from '../../lib/liked-csv.js';
import { loadState } from './data.js';
import { toast } from './toast.js';

export async function exportLikedSongs() {
  const state = (await loadState()) || {};
  const saved = state.saved || [];
  if (!saved.length) { toast('There are no Liked Songs to export yet.'); return; }
  // (a byte order mark first, so spreadsheets read the accents)
  const blob = new Blob(['\uFEFF', likedCsv(saved, state.pool || {})], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = likedCsvName();
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  toast(`Exported ${saved.length} ${saved.length === 1 ? 'song' : 'songs'} to ${link.download}`);
}
