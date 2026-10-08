// Extension service worker (entry point).
//
// Manifest V3 service workers are event-driven and are terminated when idle (30 s) or after 5 minutes on one event, so:
//  - every listener is registered synchronously at the top level, as Chrome requires;
//  - nothing important lives only in memory: state is in chrome.storage, and a run left "in progress" by a terminated
//    worker is detected and cleared on startup (see clearStaleStatus).
import { registerMenu } from './menu.js';
import { registerMessageHandler } from './messages.js';
import { RETRY_ALARM, enqueue, retryAfterRateLimit, runScan, syncNow, updateBadge } from './jobs.js';
import { restoreToolbarIcon, startColorSchemeWatcher } from './icon.js';
import { continueAfterLogin, forgetLoginTab, openMainPage } from './navigation.js';
import { PICKED_KEY } from '../lib/storage-keys.js';
import { clearStaleStatus } from './storage.js';

const DAILY_ALARM = 'daily';
const SCAN_ALARM = 'scan';
const SCAN_PERIOD_MINUTES = 30;   // a few albums at a time: see lib/scanner.js

registerMessageHandler();
registerMenu();

// Queued first, so it runs before any work that arrives while the worker is waking up.
enqueue(clearStaleStatus).then(updateBadge);
restoreToolbarIcon();
startColorSchemeWatcher();

// Alarms survive restarts, but not always updates: make sure the scan alarm exists whenever the worker wakes up.
chrome.alarms.get(SCAN_ALARM).then((alarm) => { if (!alarm) chrome.alarms.create(SCAN_ALARM, { delayInMinutes: 5, periodInMinutes: SCAN_PERIOD_MINUTES }); });

// Nothing is built in the background: a list is made only when the user asks for it (the opening screen, or the toggle).
chrome.runtime.onInstalled.addListener(() => chrome.alarms.clear(DAILY_ALARM)); // older versions built a list every few hours
chrome.runtime.onStartup.addListener(() => { enqueue(syncNow); });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RETRY_ALARM) retryAfterRateLimit();
  else if (alarm.name === SCAN_ALARM) runScan();
});
chrome.action.onClicked.addListener(openMainPage);
// After the toolbar icon sent a signed-out user to Bandcamp's login page, take that tab on to "daily recs" once they're in.
chrome.tabs.onUpdated.addListener(continueAfterLogin);
chrome.tabs.onRemoved.addListener(forgetLoginTab);

// Another device changed the shared taste: merge it.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes['taste:meta']) enqueue(syncNow);
  // The user picked another list: the numbers on the icon follow it.
  if (area === 'local' && changes[PICKED_KEY]) enqueue(updateBadge);
});
