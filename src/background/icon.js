// Toolbar icon: a dark symbol for light toolbars and a light one for dark toolbars. Chrome can't switch icons by theme on
// its own, so an offscreen page (see offscreen/color-scheme.js) reports the colour scheme, and we remember and apply it.
// Chrome resets the icon on restart, so the remembered scheme is applied again when the worker starts.
const SCHEME_KEY = 'colorScheme';   // true when the browser reported dark mode
const OFFSCREEN_PAGE = 'src/background/offscreen/color-scheme.html';

const iconPaths = (dark) => Object.fromEntries([16, 32].map((size) => [size, `icons/${dark ? 'dark/' : ''}icon-${size}.png`]));

/** Dark toolbar → the white symbol. Until a scheme is known the manifest default (white) stays. */
export async function refreshToolbarIcon() {
  const dark = (await chrome.storage.local.get(SCHEME_KEY))[SCHEME_KEY];
  if (dark === undefined) return;
  try { await chrome.action.setIcon({ path: iconPaths(dark) }); } catch { /* the toolbar may not be ready: the next call will do it */ }
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
