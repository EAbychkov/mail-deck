/* global Remind, repeater */

// core/check.js loads core/utils/remind.js; it hides the waiting mail.
// One alarm for the earliest reminder; when it rings, the due mail gets its
// notification and a check brings it back to the panel and the badge.
{
  const schedule = async () => {
    const list = await Remind.read();
    if (list.length) {
      chrome.alarms.create('remind', {
        when: Math.max(Date.now() + 1000, Math.min(...list.map(o => o.until)))
      });
    }
    else {
      chrome.alarms.clear('remind');
    }
  };
  // A reminder closed without a click leaves what its click would have opened in the session
  // storage; the ones off the screen for a day go before new ones come.
  const prune = async () => {
    const shown = await new Promise(resolve => chrome.notifications.getAll(o => resolve(o || {})));
    const all = await chrome.storage.session.get(null);
    const gone = Object.keys(all).filter(key => key.startsWith('remind.') && !(key in shown) &&
      !(Date.now() - all[key]?.at < 24 * 3600 * 1000));
    if (gone.length) {
      await chrome.storage.session.remove(gone);
    }
  };
  const ring = async () => {
    const list = await Remind.read();
    const due = list.filter(o => o.until <= Date.now());
    if (due.length) {
      await prune().catch(() => {});
      await Remind.write(Remind.waiting(list));
      for (const o of due) {
        const id = 'remind.' + Math.random();
        chrome.storage.session.set({
          [id]: {link: o.link, open: o.open || o.link, at: Date.now()}
        });
        chrome.notifications.create(id, {
          type: 'basic',
          iconUrl: '/data/icons/notification/48.png',
          title: chrome.i18n.getMessage('panel_reminderTitle'),
          message: [o.title, o.from].filter(Boolean).join('\n'),
          priority: 2,
          requireInteraction: true
        });
      }
      repeater.reset('remind', 500);
    }
    schedule();
  };

  chrome.alarms.onAlarm.addListener(o => {
    if (o.name === 'remind') {
      ring();
    }
  });
  chrome.notifications.onClicked.addListener(id => {
    if (id.startsWith('remind.')) {
      chrome.storage.session.get(id, prefs => {
        chrome.storage.session.remove(id);
        if (prefs[id]) {
          self.openLink(prefs[id].open);
          self.checkEmails.opened(prefs[id].link);
        }
      });
    }
  });
  // the panel writes the list; the badge and the alarm follow it
  chrome.storage.onChanged.addListener((ps, area) => {
    if (area === 'local' && ps[Remind.KEY]) {
      schedule();
      self.checkEmails.refresh();
    }
  });
  schedule();
}
