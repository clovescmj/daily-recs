// The Liked Songs as a CSV file (one song per line, the oldest first, like the order they were added in).
// The last two columns say which album and track a line is, so the file can be read back one day.

const HEADER = ['Artist', 'Song', 'Album', 'Album link', 'Album ID', 'Track number'];
const FORMULA_START = /^[=+\-@\t\r]/;

/** One cell. Text that a spreadsheet would run as a formula starts with an apostrophe; commas, quotes and line breaks are quoted. */
function cell(value) {
  let text = String(value ?? '');
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** `saved`: the entries of the list ({ id, i, title }); `pool`: the albums by id ({ title, artist, url }). */
export function likedCsv(saved, pool = {}) {
  const lines = [HEADER.join(',')];
  for (const entry of saved) {
    const album = pool[entry.id] || {};
    const number = Number.isInteger(entry.i) ? entry.i + 1 : '';
    lines.push([
      album.artist || '', entry.title || (number ? `Track ${number}` : ''), album.title || '', /^https:\/\//i.test(album.url || '') ? album.url : '', entry.id, number,
    ].map(cell).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

export const likedCsvName = (date = new Date()) => {
  const two = (n) => String(n).padStart(2, '0');
  return `daily-recs-liked-songs-${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}.csv`;
};
