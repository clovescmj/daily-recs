// Tiny DOM helpers shared by the page modules.
export const $ = (id) => document.getElementById(id);

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escapes text for use in HTML content and attribute values. */
export const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

/** Only https URLs are put into href/src attributes. */
export const safeUrl = (url) => (/^https:\/\//i.test(url) ? url : '#');

/** Writes only when the value changed (avoids needless layout work on frequent updates). */
export const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };

export const formatNumber = (n) => Number(n || 0).toLocaleString('en-US');

export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
