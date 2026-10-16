// Toolbar icon: a dark symbol for light toolbars and a light one for dark toolbars. Chrome can't switch icons by theme on
// its own, so an offscreen page (see offscreen/color-scheme.js) reports the colour scheme, and we remember and apply it.
// Chrome resets the icon on restart, so the remembered scheme is applied again when the worker starts.
import { WHATS_NEW_KEY } from '../lib/storage-keys.js';

const SCHEME_KEY = 'colorScheme';   // true when the browser reported dark mode
const DOT_COLOR = '#FF7300';
// The part of the 198 x 206 drawing that is used: the symbol (x 16 to 182, y 54 to 152) and the dot (up to x 191, ring up to y 29),
// so the symbol is as large as the icon allows.
const CROP_X = 16;
const CROP_Y = 29;
const CROP_WIDTH = 175;
const CROP_HEIGHT = 123;
const DOT_X = 168;
const DOT_Y = 60;
const DOT_RADIUS = 23;              // the orange part; the ring around it is 8 units wide
const DOT_RING = 8;
const SYMBOL_PATH = 'M150.213 112.949C121.858 107.61 116.324 100.103 111.188 68C105.645 102.641 99.6406 108.645 65 114.188C96.6401 119.25 104.388 124.698 109.717 152H16L68.8428 54H182L150.213 112.949ZM129.157 152H112.658C117.463 127.379 124.236 120.531 148.724 115.711L129.157 152Z';
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

/**
 * The icon with news: the symbol and an orange dot over its top right corner (as designed, in units of a 198 x 206 drawing).
 * It is drawn from the paths of the icon files, because Chrome has no way to put a dot on an icon. The ring around the dot is cut out, so
 * it takes the colour of the toolbar, light or dark.
 */
function iconWithDot(dark) {
  const imageData = {};
  for (const size of [16, 32]) {
    const canvas = new OffscreenCanvas(size, size);
    const context = canvas.getContext('2d');
    const scale = size / CROP_WIDTH;
    context.setTransform(scale, 0, 0, scale, -CROP_X * scale, (size - CROP_HEIGHT * scale) / 2 - CROP_Y * scale);
    context.fillStyle = dark ? '#ffffff' : '#111111';
    context.fill(new Path2D(SYMBOL_PATH));
    context.globalCompositeOperation = 'destination-out';
    context.beginPath();
    context.arc(DOT_X, DOT_Y, DOT_RADIUS + DOT_RING, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = 'source-over';
    context.beginPath();
    context.arc(DOT_X, DOT_Y, DOT_RADIUS, 0, Math.PI * 2);
    context.fillStyle = DOT_COLOR;
    context.fill();
    context.setTransform(1, 0, 0, 1, 0, 0);
    imageData[size] = context.getImageData(0, 0, size, size);
  }
  return imageData;
}

/** Dark toolbar → the white symbol; with news of a major update, a dot on it. Until a scheme is known the manifest default (white) stays. */
export async function refreshToolbarIcon() {
  const stored = (await chrome.storage.local.get(SCHEME_KEY))[SCHEME_KEY];
  const news = await pendingWhatsNew();
  const dark = stored === undefined ? true : stored;   // (the manifest default is the white symbol)
  try {
    if (news) {
      try { await chrome.action.setIcon({ imageData: iconWithDot(dark) }); return; } catch { /* no canvas here: the plain icon */ }
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
