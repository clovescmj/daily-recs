document.getElementById('version').textContent = chrome.runtime.getManifest().version;
// Looking at the news takes the dot off the toolbar icon (see background/icon.js).
chrome.storage.local.remove('whatsNew');
