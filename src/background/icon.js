// Toolbar icon: a dark symbol for light toolbars and a light one for dark toolbars. Chrome can't switch icons by theme on
// its own, so an offscreen page (see offscreen/color-scheme.js) reports the colour scheme, and we remember and apply it.
// Chrome resets the icon on restart, so the remembered scheme is applied again when the worker starts.
import { WHATS_NEW_KEY } from '../lib/storage-keys.js';

const SCHEME_KEY = 'colorScheme';   // true when the browser reported dark mode
const DOT_COLOR = '#f99f32';
const DOT_MAX_DAYS = 7;             // the dot goes away by itself
const OFFSCREEN_PAGE = 'src/background/offscreen/color-scheme.html';

const iconPaths = (dark) => Object.fromEntries([16, 32].map((size) => [size, `icons/${dark ? 'dark/' : ''}icon-${size}.png`]));

/** The news of the last major update, or null when there is none (or it is a week old: it is then forgotten). */
export async function pendingWhatsNew() {
  const stored = (await chrome.storage.local.get(WHATS_NEW_KEY))[WHATS_NEW_KEY];
  if (!stored || typeof stored.version !== 'string') return null;
  if (Date.now() - (stored.at || 0) > DOT_MAX_DAYS * 86_400_000) {
    await chrome.storage.local.remove(WHATS_NEW_KEY);
    return null;
  }
  return stored;
}

/** The icon of the toolbar with a small dot in its top right corner (drawn here: Chrome has no way to put a dot on an icon). */
async function iconWithDot(dark) {
  const imageData = {};
  for (const size of [16, 32]) {
    const response = await fetch(chrome.runtime.getURL(iconPaths(dark)[size]));
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    const radius = size / 6.5;
    const x = size - radius;   // against the right edge of the icon
    const y = radius + 0.5;
    context.globalCompositeOperation = 'destination-out';   // a thin gap around the dot, so it does not blur into the symbol
    context.beginPath();
    context.arc(x, y, radius + size / 16, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = 'source-over';
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = DOT_COLOR;
    context.fill();
    imageData[size] = context.getImageData(0, 0, size, size);
  }
  return imageData;
}

/** Dark toolbar → the white symbol; with news of a major update, a dot on it. Until a scheme is known the manifest default (white) stays. */
export async function refreshToolbarIcon() {
  const stored = (await chrome.storage.local.get(SCHEME_KEY))[SCHEME_KEY];
  const news = await pendingWhatsNew();
  if (stored === undefined && !news) return;
  const dark = stored === undefined ? true : stored;   // (the manifest default is the white symbol)
  try {
    if (news) {
      try { await chrome.action.setIcon({ imageData: await iconWithDot(dark) }); return; } catch { /* no canvas here: the plain icon */ }
    }
    await chrome.action.setIcon({ path: iconPaths(dark) });
  } catch { /* the toolbar may not be ready: the next call will do it */ }
}

/** A page reported the colour scheme. */
export async function setColorScheme(dark) {
  if ((await chrome.storage.local.get(SCHEME_KEY))[SCHEME_KEY] === dark) return;
  await chrome.storage.local.set({ [SCHEME_KEY]: dark });
  await refreshToolbarIcon();
}

/** Starts the offscreen page that watches the colour scheme (at most one exists). */
export async function startColorSchemeWatcher() {
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_PAGE,
      reasons: ['MATCH_MEDIA'],
      justification: 'Detect the browser colour scheme to choose a toolbar icon that is visible on light and dark themes.',
    });
  } catch { /* already running */ }
}

export const restoreToolbarIcon = refreshToolbarIcon;
