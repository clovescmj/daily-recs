// Extension service worker (entry point).
//
// Manifest V3 service workers are event-driven and are terminated when idle (30 s) or after 5 minutes on one event, so:
//  - every listener is registered synchronously at the top level, as Chrome requires;
//  - nothing important lives only in memory: state is in chrome.storage, and a run left "in progress" by a terminated
//    worker is detected and cleared on startup (see clearStaleStatus).
import { registerMenu } from './menu.js';
import { registerMessageHandler } from './messages.js';
import { RETRY_ALARM, enqueue, retryAfterRateLimit, runRefresh, syncNow, updateBadge } from './jobs.js';
import { continueAfterLogin, forgetLoginTab, openMainPage } from './navigation.js';
import { clearStaleStatus } from './storage.js';

const DAILY_ALARM = 'daily';
const ALARM_PERIOD_MINUTES = 360; // checked every 6 h; a new list is only built when the day has changed

registerMessageHandler();
registerMenu();

// Queued first, so it runs before any work that arrives while the worker is waking up.
enqueue(clearStaleStatus).then(updateBadge);

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(DAILY_ALARM, { delayInMinutes: 1, periodInMinutes: ALARM_PERIOD_MINUTES });
});
chrome.runtime.onStartup.addListener(() => { enqueue(syncNow); runRefresh(); });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DAILY_ALARM) runRefresh();
  else if (alarm.name === RETRY_ALARM) retryAfterRateLimit();
});
chrome.action.onClicked.addListener(openMainPage);
// After the toolbar icon sent a signed-out user to Bandcamp's login page, take that tab on to "daily recs" once they're in.
chrome.tabs.onUpdated.addListener(continueAfterLogin);
chrome.tabs.onRemoved.addListener(forgetLoginTab);

// Another device changed the shared taste: merge it.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes['taste:meta']) enqueue(syncNow);
});
