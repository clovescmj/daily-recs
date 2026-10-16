// The notice of what is new: the first block of the What's new page (its title and its items), read as text (no DOM: this also runs in tests).

const decode = (text) => text
  .replace(/<[^>]*>/g, '')
  .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

const MAX_ITEMS = 8;
const MAX_LENGTH = 240;

/** `{ title, items }` of the first block of the page, or null when there is none. */
export function latestNews(html) {
  const block = /<h2>([\s\S]*?)<\/h2>\s*<ul>([\s\S]*?)<\/ul>/.exec(String(html || ''));
  if (!block) return null;
  const title = decode(block[1]).slice(0, MAX_LENGTH);
  const items = [...block[2].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => decode(m[1]).slice(0, MAX_LENGTH)).filter(Boolean).slice(0, MAX_ITEMS);
  return title && items.length ? { title, items } : null;
}

/**
 * Whether the notice is shown. It is when the block is not the one the user closed last time. A user who has not used the extension yet
 * (nothing seen, nothing of theirs saved) has nothing that is new to them: the block is only marked as seen.
 */
export function newsAction({ title, seen, hasLibrary }) {
  if (seen === title) return 'none';
  if (seen === undefined && !hasLibrary) return 'mark';
  return 'show';
}
