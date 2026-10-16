// Runs in an offscreen document (the service worker has no matchMedia). Reports the browser's colour scheme to the service
// worker now and whenever it changes, so the toolbar icon can use the symbol that suits the theme.
const COLOR_SCHEME_MESSAGE = 'color-scheme';        // keep in sync with MSG.COLOR_SCHEME (src/lib/messages.js)
const query = matchMedia('(prefers-color-scheme: dark)');
const report = () => chrome.runtime.sendMessage({ type: COLOR_SCHEME_MESSAGE, dark: query.matches }).catch(() => {});
report();
query.addEventListener('change', report);
