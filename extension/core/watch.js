/* global repeater */

/* updating badge when action is posted */

{
  // undefined until read; a stored false turns it off, a removed setting is the default again
  let watching;
  chrome.storage.onChanged.addListener(ps => {
    if ('network.watch' in ps) {
      watching = ps['network.watch'].newValue !== false;
    }
  });

  const observe = async d => {
    // A request of a Gmail tab. The extension's own requests carry no tab (TAB_ID_NONE, -1):
    // its feeds, its actions, which ask for a check themselves, and the panel's searches.
    if (d.tabId > 0) {
      if (
        d.type === 'main_frame' ||
        d.url.includes('&act=') ||
        (d.url.includes('/sync/u/') && d.method === 'POST') ||
        (d.url.includes('/mail/u/') && d.method === 'POST')
      ) {
        if (watching === undefined) {
          const prefs = await chrome.storage.local.get({
            'network.watch': true
          });
          watching = prefs['network.watch'] !== false;
        }
        if (watching) {
          repeater.reset('webrequest', 1000);
        }
      }
    }
  };

  // Registered at once: the event that wakes a stopped worker reaches only the listeners its
  // first run registers, so the setting is read when the event comes, not before.
  chrome.webRequest.onCompleted.addListener(observe, {
    urls: [
      '*://mail.google.com/mail/u*',
      '*://mail.google.com/sync/u/*/i/s*',
      '*://mail.google.com/mail/logout*'
    ]},
  []);
}
