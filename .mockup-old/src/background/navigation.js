// Opening the extension's pages and the user's profile tab.
import { NotLoggedInError, getFan } from '../lib/bandcamp.js';
import { store } from './storage.js';

const LOGIN_URL = 'https://bandcamp.com/login';
const BANDCAMP_HOME = 'https://bandcamp.com/';
const PENDING_LOGIN_KEY = 'pendingLogin';          // chrome.storage.session: survives the worker being restarted
const PENDING_LOGIN_MAX_MS = 15 * 60 * 1000;
const BANDCAMP_PAGE = /^https:\/\/([\w-]+\.)?bandcamp\.com\//;
const SIGN_IN_PAGE = /^\/(login|signup|password_reset)/;

const request = (...args) => fetch(...args);

export const openExtensionPage = (path) => chrome.tabs.create({ url: chrome.runtime.getURL(path) });

/** Opens (or focuses) the profile tab at the "daily recs" panel. */
async function openProfileTab(profileUrl) {
  const target = `${profileUrl}#dailyrecs`;
  const [existing] = await chrome.tabs.query({ url: `${profileUrl}*` });
  if (existing) {
    await chrome.tabs.update(existing.id, { url: target, active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: target });
  }
}

/**
 * Not signed in: open Bandcamp's login page and remember that tab, so that once the user is signed in it is sent on to
 * the "daily recs" panel (see continueAfterLogin).
 */
async function startLogin() {
  const tab = await chrome.tabs.create({ url: LOGIN_URL });
  await chrome.storage.session.set({ [PENDING_LOGIN_KEY]: { tabId: tab.id, at: Date.now() } });
}

/**
 * What the toolbar icon does. Signed in: go to the "daily recs" panel on the profile. Signed out: ask to sign in first,
 * then continue to the panel. If Bandcamp can't be reached, use the profile remembered from the last run, or just open
 * Bandcamp.
 */
export async function openMainPage() {
  let profileUrl;
  try {
    profileUrl = (await getFan(request)).profileUrl;
  } catch (error) {
    if (error instanceof NotLoggedInError) return startLogin();
    profileUrl = ((await store.load()) || {}).profileUrl;
  }
  if (!profileUrl) return chrome.tabs.create({ url: BANDCAMP_HOME });
  return openProfileTab(profileUrl);
}

/** Called for every finished page load: if it is the login tab we opened and the user is now signed in, move it on. */
export async function continueAfterLogin(tabId, changeInfo, tab) {
  if (changeInfo.status !== 'complete') return;
  const pending = (await chrome.storage.session.get(PENDING_LOGIN_KEY))[PENDING_LOGIN_KEY];
  if (!pending || pending.tabId !== tabId) return;
  if (Date.now() - pending.at > PENDING_LOGIN_MAX_MS) { await chrome.storage.session.remove(PENDING_LOGIN_KEY); return; }
  // Still on a sign-in step (or on another site, e.g. a Google sign-in): keep waiting.
  if (!tab.url || !BANDCAMP_PAGE.test(tab.url) || SIGN_IN_PAGE.test(new URL(tab.url).pathname)) return;
  try {
    const { profileUrl } = await getFan(request);
    await chrome.storage.session.remove(PENDING_LOGIN_KEY);
    await chrome.tabs.update(tabId, { url: `${profileUrl}#dailyrecs` });
  } catch { /* not signed in yet */ }
}

/** The login tab was closed: nothing to continue. */
export async function forgetLoginTab(tabId) {
  const pending = (await chrome.storage.session.get(PENDING_LOGIN_KEY))[PENDING_LOGIN_KEY];
  if (pending && pending.tabId === tabId) await chrome.storage.session.remove(PENDING_LOGIN_KEY);
}
