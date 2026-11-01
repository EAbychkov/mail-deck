/* global log, button, context, Feed, repeater, sound, toast, Resolved, Remind, Quiet, Services */

if (typeof importScripts !== 'undefined') {
  self.importScripts('/core/utils/feed.js');
  self.importScripts('/core/utils/resolved.js');
  self.importScripts('/core/utils/remind.js');
  self.importScripts('/core/utils/quiet.js');
}

{
  const helper = {
    id(href) {
      const m = href.match(/u\/(?<n>\d+)/);
      if (m) {
        return Number(m.groups.n);
      }
    },
    base(href) {
      return /[^?]*/.exec(href)[0].split('/h')[0].replace(/\/$/, '');
    },
    thread(href) {
      const m = href.match(/message_id=(?<thread>[^&]+)/);
      if (m) {
        return m.groups.thread;
      }
    },
    /*
     * The thread of a link, no matter how it is printed. A label feed prints
     * its entries as <account>/?shva=1#label/<label>/<thread>, so the last part
     * of the hash is the thread and not the first one.
     */
    threadId(href) {
      const m = /[?&]message_id=([^&#]*)/.exec(href);
      if (m && m[1]) {
        return m[1];
      }
      const hash = /#([^#]*)$/.exec(href);
      return hash ? decodeURIComponent(hash[1].split('/').pop() || '') : '';
    },
    /*
     * Date.parse() returns NaN for anything it cannot read and throws only for
     * symbols; the type check plus the try/catch makes a malformed clock
     * impossible to turn into anything but NaN, whatever session storage holds.
     */
    time(value) {
      if (typeof value !== 'string' || value === '') {
        return NaN;
      }
      try {
        return Date.parse(value);
      }
      catch (e) {
        return NaN;
      }
    }
  };

  const isPrivate = false;
  // a forced check shows the loading icon until a check publishes its result
  let loading = false;

  const read = (prefs, type = 'local') => chrome.storage[type].get(prefs);

  const notify = async (text, title, click = {}, buttons = []) => {
    title = title || chrome.i18n.getMessage('gmail');

    const p2 = await read({
      'silent': false
    }, 'session');
    if (p2.silent) {
      log('[feed]', 'notification is silent', text, title);
      return;
    }
    const p1 = await read({
      'notificationTime': 10, // seconds
      'notification.state.active': true,
      'notification.state.idle': true,
      'notification.state.locked': true
    }, 'local');

    if (
      p1['notification.state.active'] === false ||
      p1['notification.state.idle'] === false ||
      p1['notification.state.locked'] === false
    ) {
      const state = await chrome.idle.queryState(5 * 60);
      if (p1['notification.state.' + state] === false) {
        log('[feed]', 'notification is aborted', text, title);
        return;
      }
    }

    let isArray = Array.isArray(text);
    if (isArray && text.length === 1) {
      isArray = false;
      text = text[0];
    }
    // Users on Mac OS X only see the first item.
    if (isArray && navigator.platform.includes('Mac')) {
      isArray = false;
      text = text.join('\n\n');
    }

    const when = Date.now() + p1.notificationTime * 1000;
    const options = {
      type: isArray ? 'list' : 'basic',
      iconUrl: '/data/icons/notification/48.png',
      title,
      message: isArray ? '' : text,
      priority: 2,
      eventTime: when,
      items: isArray ? text.map(message => {
        const tmp = message.split('\n');
        return {
          title: (tmp[1] || '').replace('Title: ', ''),
          message: tmp[0].replace('From: ', '')
        };
      }) : [],
      requireInteraction: click ? true : false,
      buttons: buttons.map(b => ({
        title: b.title,
        iconUrl: b.iconUrl
      }))

    };
    if (navigator.userAgent.includes('Firefox')) {
      delete options.requireInteraction;
      delete options.buttons;
    }
    // if (config.notification.actions === false) {
    //   delete options.buttons;
    // }

    const id = 'action.' + Math.random();
    chrome.storage.session.set({
      [id]: {
        buttons: (buttons || []).map(o => o.action),
        click
      }
    });
    // Chrome fires an alarm at most once in 30 seconds (unpacked extensions aside), so the
    // timer clears the notification on time while the worker is awake; the alarm stays for a
    // worker that is gone by then
    chrome.alarms.create('clear.notification.' + id, {
      when
    });
    setTimeout(clear, p1.notificationTime * 1000, id);
    chrome.notifications.create(id, options);
  };
  const clear = id => {
    chrome.notifications.clear(id);
    chrome.storage.session.remove(id);
    chrome.alarms.clear('clear.notification.' + id);
  };
  chrome.notifications.onClicked.addListener(id => {
    chrome.notifications.clear(id);
    sound.stop();
    if (id.startsWith('action.')) {
      chrome.alarms.clear('clear.notification.' + id);
      chrome.storage.session.get(id, prefs => {
        chrome.storage.session.remove(id);
        if (!prefs[id]) {
          return;
        }
        const {click} = prefs[id];
        if (click.cmd === 'open') {
          const {links} = click;
          // use open to open the first link and use chrome.tabs.create for the rest
          self.openLink(links[0]);
          links.slice(1).forEach(url => chrome.tabs.create({
            url,
            active: false
          }));
          // every mail of the report is open now
          self.checkEmails.opened(links);
        }
        else {
          console.error('No action', click);
        }
      });
    }
  });
  chrome.alarms.onAlarm.addListener(o => {
    if (o.name.startsWith('clear.notification.')) {
      const id = o.name.slice(19);
      chrome.notifications.clear(id);
      chrome.storage.session.remove(id);
    }
  });
  if (chrome.notifications.onButtonClicked) {
    chrome.notifications.onButtonClicked.addListener((id, index) => {
      sound.stop();

      chrome.alarms.clear('clear.notification.' + id);
      chrome.storage.session.get(id, prefs => {
        chrome.storage.session.remove(id);
        chrome.notifications.clear(id);

        const request = prefs[id]?.buttons?.[index];
        if (!request) {
          return;
        }
        // links might be from different accounts; the mail of the other services is one
        // request, which they split by mailbox themselves
        const bases = {};
        for (const link of request.links) {
          const base = Services.of(link) ? 'services' : helper.base(link);
          bases[base] = bases[base] || [];
          bases[base].push(link);
        }
        const requests = Object.values(bases).map(links => ({
          ...request,
          links
        }));
        // dispatch
        chrome.storage.local.get({
          doReadOnArchive: true
        }, prefs => {
          requests.forEach(r => r.prefs = prefs);
          Promise.all(requests.map(request => Services.dispatch(request))).then(async arr => {
            const errors = arr.filter(o => o !== true);
            if (errors.length) {
              console.error(errors);
              toast(errors.map(e => e.message).join('\n\n'));
            }
            // every button of a notification reduces the count, so the panel and
            // the badge can be updated without waiting for the next check
            const resolved = requests.filter((request, i) => arr[i] === true);
            for (const request of resolved) {
              await Resolved.record(request.links);
            }
            if (resolved.length) {
              await self.checkEmails.refresh();
            }
          }).finally(() => repeater.reset('action.command', 500));
        });
      });
    });
  }

  const shorten = (str = '', truncate) => {
    if (str.length < truncate) {
      return str;
    }
    return str.substr(0, truncate / 2) + '...' + str.substr(str.length - truncate / 2);
  };

  const attach = () => chrome.action.setPopup({
    popup: '/data/panel/index.html'
  });
  const detach = () => {
    chrome.action.setPopup({
      popup: ''
    });
    chrome.runtime.sendMessage({
      method: 'close-popup'
    }, () => chrome.runtime.lastError);
  };
  chrome.storage.onChanged.addListener(ps => {
    if (ps.oldFashion) {
      self.checkEmails.visible().then(objs => {
        const numberOfAccounts = objs.map(o => o.xml ? o.xml.title : null)
          .filter((o, i, a) => o && a.indexOf(o) === i).length;
        const hasUnread = objs.map(o => o.xml ? o.xml.fullcount : 0)
          .reduce((p, c) => p + c, 0);

        if (numberOfAccounts === 1 && ps.oldFashion.newValue === 1) {
          detach();
        }
        else if (hasUnread) {
          attach();
        }
      });
    }
  });

  // Each of the 10 accounts Google lets a profile sign in to is checked: the
  // labels set for it, or its inbox when none are set
  const buildFeeds = prefs => {
    const feeds = [];
    for (let i = 0; i < 10; i += 1) {
      const base = `https://mail.google.com/mail/u/${i}/feed/atom`;
      const labels = (prefs['feeds_' + i] || '').split(/\s*,\s*/).filter(Boolean);
      // only feeds without '/inbox' show the right full-count
      feeds.push(...(labels.length ? labels.map(l => l === 'inbox' ? base : base + '/' + encodeURIComponent(l)) : [base]));
    }
    if (prefs.feeds_custom) {
      feeds.push(...prefs.feeds_custom.split(/\s*,\s*/g));
    }
    return feeds.filter((feed, index) => feed && feeds.indexOf(feed) === index).sort();
  };

  /*
   * The accounts of the last check as the feeds told them, resolved and reminded mail
   * included: hiding is applied on the way out (visible, refresh, the panel), so mail an
   * Undo or a failed action brings back is there to show again.
   */
  self.checkEmails = {
    getCached() {
      if (self.checkEmails.cached) {
        return Promise.resolve(self.checkEmails.cached);
      }
      return read({
        'cached-objects': []
      }, 'session').then(prefs => prefs['cached-objects']);
    }
  };
  // the accounts as the panel and the badge show them: without the resolved mail and the
  // mail waiting for its reminder
  self.checkEmails.visible = async () => Resolved.apply(Resolved.apply(await self.checkEmails.getCached(),
    await Resolved.read()), Remind.waiting(await Remind.read()));
  // Show the accounts as they are now: the badge, the panel and, when nothing
  // is left to read, the panel itself. The given objects are expected to be
  // already filtered by Resolved.apply(); the cache keeps the unfiltered ones.
  self.checkEmails.publish = async objs => {
    loading = false;
    const active = objs.filter(c => c.meta?.ignored !== true);
    const count = active.reduce((p, c) => p + c.xml.fullcount, 0);

    chrome.storage.session.set({count});
    if (count) {
      button.icon = 'red';
      button.badge = count;
    }
    else {
      button.icon = 'gray';
      button.badge = 0;
    }
    chrome.runtime.sendMessage({
      method: 'update',
      data: objs
    }, () => chrome.runtime.lastError);

    const {oldFashion} = await chrome.storage.local.get({
      oldFashion: 0
    });
    const singleAccount = oldFashion === 2 ||
      (oldFashion === 1 && active.map(o => o.xml.rootLink).filter((s, i, l) => l.indexOf(s) === i).length === 1);

    // the panel stays even with nothing unread: it lists the accounts
    if (singleAccount) {
      detach();
    }
    else {
      attach();
    }
    return count;
  };
  // Apply the resolved entries to the cached accounts and publish the result,
  // so the panel and the badge do not wait for the next check
  self.checkEmails.refresh = async () => self.checkEmails.publish(await self.checkEmails.visible());
  /*
   * Opening a mail marks it as read in Gmail, so it has to leave the panel and
   * the badge. The feed cannot report it yet, therefore the link is stored like
   * a resolved one and is forgotten as soon as the feed agrees.
   * Only a listed entry counts: the link of the account, a mailto or a link of
   * the mail body is not a mail the user has read.
   */
  self.checkEmails.opened = async links => {
    if (typeof links === 'string') {
      links = [links];
    }
    if (!links || links.length === 0) {
      return;
    }
    const wanted = links.filter(l => typeof l === 'string').map(link => ({
      link,
      account: helper.id(link),
      thread: helper.threadId(link)
    }));
    if (wanted.length === 0) {
      return;
    }
    const done = new Set();
    for (const o of await self.checkEmails.getCached()) {
      for (const e of o.xml.entries) {
        const account = helper.id(e.link);
        const thread = helper.threadId(e.link);
        if (wanted.some(w => w.link === e.link ||
          // the same thread of the same account, however it is printed
          (w.account !== undefined && w.account === account && w.thread !== '' && w.thread === thread))) {
          done.add(e.link);
        }
      }
    }
    if (done.size === 0) {
      return;
    }
    // Gmail marks a mail read by itself when it is opened in a tab, which takes
    // longer to reach the feed than an action sent to the server
    await Resolved.record([...done], 20000);
    return self.checkEmails.refresh();
  };
  /*
   * A check that no Gmail feed answered met a network that is down (offline, a laptop just
   * awake, a timeout), not accounts that are signed out: the badge, the panel and the
   * resolved mail stay as they are, and no sign-in tab opens. A forced check shows the last
   * state again, which also ends its loading icon.
   */
  const keep = async forced => {
    log('[feed]', 'no answer from the network, the last state stays');
    if (!forced && !loading) {
      return;
    }
    if ((await self.checkEmails.getCached()).length) {
      await self.checkEmails.refresh();
    }
    else {
      loading = false;
      button.icon = 'blue';
      button.badge = 0;
      chrome.storage.session.set({count: -1});
    }
  };
  self.checkEmails.execute = async forced => {
    if (navigator.onLine === false) {
      return keep(forced);
    }
    // a newer check takes over at once, even from one still reading its settings
    self.checkEmails.controller?.abort();
    const controller = self.checkEmails.controller = new AbortController();
    const signal = controller.signal;

    if (forced) {
      loading = true;
      button.icon = 'load';
      button.badge = 0;
      // do not use -1; if the user is logged out, the loading need to be stopped
      chrome.storage.session.set({count: 0});
    }
    const prefs = await read({
      'url': 'https://mail.google.com/mail/u/0',
      'feeds_0': '',
      'feeds_1': '',
      'feeds_2': '',
      'feeds_3': '',
      'feeds_4': '',
      'feeds_5': '',
      'feeds_6': '',
      'feeds_7': '',
      'feeds_8': '',
      'feeds_9': '',
      'feeds_custom': '',
      'timeout': 9000,
      'alphabetic': false,
      'notificationTruncate': 70,
      'combined': navigator.userAgent.includes('Firefox'),
      'maxReport': 3,
      'oldFashion': 0,
      'notification': true,
      'notification.buttons.markasread': true,
      'notification.buttons.archive': true,
      'notification.buttons.trash': false,
      'alert': true,
      'notificationFormat': chrome.i18n.getMessage('notification'),
      'notify.never': '',
      'notify.only': '',
      'quiet.hours': false,
      'quiet.from': '22:00',
      'quiet.to': '08:00',
      'quiet.weekend': false,
      'accounts': {}
    });
    if (signal.aborted) {
      return log('[feed]', 'skipped');
    }

    const services = Services.collect(signal, prefs.timeout).catch(e => {
      log('[services]', 'error', e);
      return [];
    });

    const fdsr = buildFeeds(prefs); // requested feeds
    // do not reduce the feed list from cookies. It is not reliable
    const feeds = fdsr.map(feed => new Feed(feed, prefs.timeout, isPrivate));

    // the settings of an account, made when it is seen for the first time; a mailbox of another
    // service remembers which, so it can be signed in to again once it is signed out
    const meta = r => {
      const {title, service} = r.xml;
      if (!title) {
        return;
      }
      r.meta = prefs.accounts[title];
      if (!r.meta || (service && r.meta.service !== service)) {
        r.meta = prefs.accounts[title] = service ? {...r.meta, service} : r.meta || {};
        chrome.storage.local.set({
          accounts: prefs.accounts
        });
      }
    };

    try {
      const objs = [];
      let mn = -1; // keep track of the last logged-out account
      let top = -1; // the last signed-in account
      // a feed that answered at all, signed in or not; a signed-out account answers too
      let answered = false;
      const uids = new Set();
      // The accounts signed in at the last check, and the one after them, which
      // tells a newly added account, are fetched all at once; the walk below
      // still meets them in order. Past them it fetches one by one as before.
      const {'accounts.count': known = 0} = await chrome.storage.session.get('accounts.count');
      const early = new Map(feeds.filter(feed => helper.id(feed.href) <= known).map(feed => [feed,
        feed.execute(signal).catch(e => signal.aborted === false && log('[feed]', 'error', e))]));
      for (const feed of feeds) {
        if (mn !== -1) {
          if (helper.id(feed.href) >= mn) { // belongs to a logged-out account
            continue;
          }
        }

        let r;
        if (early.has(feed)) {
          r = await early.get(feed);
          answered = answered || Boolean(r);
          // fetched out of order: a feed that repeats an earlier one is a logged-out account
          const uid = r?.xml?.id;
          if (uid && uids.has(uid)) {
            const n = helper.id(feed.href);
            mn = mn === -1 ? n : Math.min(mn, n);
            r = null;
          }
          else if (uid) {
            uids.add(uid);
          }
        }
        else {
          r = await feed.execute(signal, uid => { // do not check logged-out feeds
            if (uid) {
              if (uids.has(uid)) { // this is a logged-out account
                const n = helper.id(feed.href);
                mn = mn === -1 ? n : Math.min(mn, n);

                return true;
              }
              uids.add(uid);
            }
          }).catch(e => signal.aborted === false && log('[feed]', 'error', e));
          answered = answered || Boolean(r);
        }
        if (signal.aborted) {
          return log('[feed]', 'skipped');
        }
        if (r && r.notAuthorized && mn === -1) {
          mn = helper.id(feed.href);
        }

        if (r && r.xml) {
          // only add logged-in accounts
          if (r.network && !r.notAuthorized && r.xml && r.xml.entries) {
            meta(r);
            objs.push(r);
            top = Math.max(top, helper.id(feed.href) ?? -1);
          }
        }
      }
      const boxes = await services;
      if (signal.aborted) {
        return log('[feed]', 'skipped');
      }
      // every Gmail feed failed (a fetch error or the timeout): the network, not a sign-out
      if (!answered) {
        return keep(forced);
      }
      for (const r of boxes) {
        meta(r);
        objs.push(r);
      }

      log('[feed]', 'forced', forced, 'objects', objs);
      chrome.storage.session.set({
        'accounts.count': top + 1
      });

      const isAuthorized = objs.length !== 0 && objs.some(c => !c.notAuthorized && c.network);
      const count = await new Promise(resolve => chrome.storage.session.get({
        count: -1
      }, prefs => resolve(prefs.count)));

      if (!isAuthorized) {
        loading = false;
        if (count !== -1) {
          button.icon = 'blue';
          button.badge = 0;
          chrome.storage.session.set({count: -1});
          chrome.storage.session.set({
            'cached-objects': [],
            [Resolved.KEY]: []
          });
          if (self.checkEmails.cached) {
            self.checkEmails.cached.length = 0;
          }
          context.accounts('logged.out');
        }
        if (forced) {
          self.openLink(prefs.url);
          toast(chrome.i18n.getMessage('log_into_your_account'));
        }
        button.label = chrome.i18n.getMessage('gmail');
        detach();

        log('[feed]', 'ignore checking', 'unauthorized');
        return;
      }
      // Sorting accounts
      objs.sort((a, b) => {
        if (!prefs.alphabetic && Boolean(a.xml.service) !== Boolean(b.xml.service)) {
          return a.xml.service ? 1 : -1;
        }
        const var1 = prefs.alphabetic ? a.xml.title : a.xml.link;
        const var2 = prefs.alphabetic ? b.xml.title : b.xml.link;
        if (var1 > var2) {
          return 1;
        }
        if (var1 < var2) {
          return -1;
        }
        return 0;
      });
      // simplified version of objs for storing and sending between contexts
      const simple = objs.map(o => {
        const xml = {
          ...o.xml
        };
        delete xml.parent;
        return {
          newIDs: o.newIDs,
          meta: o.meta,
          xml
        };
      });
      // what the badge, the panel and the notifications take: mail waiting for its
      // reminder stays out like a resolved one
      const cachedObjs = Resolved.apply(Resolved.apply(simple, await Resolved.prune(objs)),
        Remind.waiting(await Remind.read()));
      if (signal.aborted) {
        return log('[feed]', 'skipped');
      }

      // the cache keeps the mail as the feeds told it (see getCached)
      self.checkEmails.cached = simple;
      chrome.storage.session.set({
        'cached-objects': simple
      });

      // save new emails
      for (const o of objs) {
        o.commit();
      }

      // New total count number
      const anyNewEmails = cachedObjs.filter(c => c.meta.ignored !== true).some(c => c.newIDs.length !== 0);
      let newCount = 0;
      for (const obj of cachedObjs) {
        if (obj.meta.ignored === true) {
          continue;
        }
        newCount += obj.xml.fullcount;
      }

      if (!anyNewEmails && !forced && count === newCount) {
        // Updating panel if it is open
        chrome.runtime.sendMessage({
          method: 'update-date',
          data: cachedObjs
        }, () => {
          if (chrome.runtime.lastError) {
            return;
          }
          // maybe the current email is marked as read but still count is 20 (max value for non inbox labels)
          chrome.runtime.sendMessage({
            method: 'validate-current',
            data: cachedObjs
          });
        });
        // a forced check that a newer one took over left its loading icon
        if (loading) {
          self.checkEmails.publish(cachedObjs);
        }
        // we could have a new account with no new emails; the menu lists accounts, not
        // the label feeds of one
        const accounts = new Set(objs.map(o => o.xml?.rootLink?.replace(/\?.*/, '')).filter(Boolean));
        chrome.storage.session.get({
          'accounts.keys': []
        }, prefs => {
          if (prefs['accounts.keys'].length !== accounts.size) {
            context.accounts('mismatch');
          }
        });

        return; // Everything is clear
      }
      //
      chrome.storage.session.set({count: newCount});
      //
      context.accounts('new.email');
      // Preparing the report
      const reportArray = [];
      // an entry must not be modified, it is shared with the cached objects
      const parents = new Map();
      // a quiet mailbox and the mail the word lists leave out still count, they only make no noise
      const loud = o => o.meta.ignored !== true && o.meta.quiet !== true;
      // the new mail that may make a noise, each once: a mail in two watched labels of one
      // account is listed by both feeds. Mail that is not new stays quiet, a forced check too.
      const fresh = (() => {
        const told = new Set();
        const list = [];
        for (const o of cachedObjs) {
          if (!loud(o) || !o.xml || !o.xml.entries) {
            continue;
          }
          for (const e of o.xml.entries) {
            const key = o.xml.rootLink + ' ' + e.id;
            if (o.newIDs.includes(e.id) && !told.has(key) && Quiet.wanted(e, prefs)) {
              told.add(key);
              list.push([e, o]);
            }
          }
        }
        return list;
      })();
      for (const [e, o] of fresh) {
        parents.set(e, o);
        reportArray.push(e);
      }
      // keep recent ones
      reportArray.sort((a, b) => {
        return (new Date(b.modified)).getTime() - (new Date(a.modified)).getTime();
      });
      reportArray.splice(prefs.maxReport, reportArray.length);

      let report = reportArray.map(e => prefs.notificationFormat
        .replace('[author_name]', e.author_name)
        .replace('[author_email]', e.author_email)
        .replace('[summary]', shorten(e.summary, prefs.notificationTruncate))
        .replace('[title]', shorten(e.title, prefs.notificationTruncate))
        .replace(/\[break\]/g, '\n'));
      if (prefs.combined) {
        report = [report.join('\n\n')];
      }
      // Preparing the tooltip
      button.label = chrome.i18n.getMessage('gmail') + '\n\n' +
        cachedObjs.filter(c => c.meta.ignored !== true).reduce((p, c) => {
          return p +=
            c.xml.title +
            (c.xml.label ? ' [' + c.xml.label + ']' : '') +
            ' (' + c.xml.fullcount + ')\n';
        }, '').replace(/\n$/, '');
      //
      // nothing new, forced or not: the badge and the panel only
      if (!anyNewEmails) {
        self.checkEmails.publish(cachedObjs);
      }
      else {
        loading = false;
        button.icon = 'new';
        button.badge = newCount;
        chrome.storage.session.set({count: newCount});
        const singleAccount = prefs.oldFashion === 1 ?
          cachedObjs.filter(c => c.meta.ignored !== true)
            .map(o => o.xml.rootLink).filter((s, i, l) => l.indexOf(s) === i).length === 1 :
          prefs.oldFashion === 2;
        if (singleAccount) {
          detach();
        }
        else {
          attach();
        }

        // quiet hours, or nothing left that may make a noise: the badge alone tells
        const hushed = Quiet.hours(prefs) || reportArray.length === 0;
        if (hushed) {
          log('[feed]', 'notification and sound are held back', reportArray.length);
        }

        if (prefs.notification && !hushed) {
          const buttons = [];
          if (prefs['notification.buttons.markasread']) {
            buttons.push({
              title: chrome.i18n.getMessage('opt_btnRead'),
              iconUrl: '/data/images/read.png',
              action: {
                links: reportArray.map(o => o.link),
                cmd: 'rd'
              }
            });
          }
          // a service without an archive (Yandex, Mail.ru) gets no archive button
          if (prefs['notification.buttons.archive'] && reportArray.every(e => Services.of(e.link)?.can.archive !== false)) {
            buttons.push({
              title: chrome.i18n.getMessage('opt_btnArchive'),
              iconUrl: '/data/images/archive.png',
              action: {
                links: reportArray.map(o => o.link),
                cmd: 'rc_^i'
              }
            });
          }
          if (prefs['notification.buttons.trash']) {
            buttons.push({
              title: chrome.i18n.getMessage('opt_btnDelete'),
              iconUrl: '/data/images/trash.png',
              action: {
                links: reportArray.map(o => o.link),
                cmd: 'tr'
              }
            });
          }

          // convert links
          const links = [];
          for (const o of reportArray) {
            try {
              const account = parents.get(o);
              const base = helper.base(o.link);
              const thread = helper.thread(o.link);

              if (thread && account.xml.link.indexOf('#') === -1) {
                links.push(base + '/?shva=1#inbox/' + thread);
              }
              else if (thread) {
                links.push(account.xml.link + '/' + thread);
              }
              else {
                links.push(o.link);
              }
            }
            catch (e) {
              console.error(e);
              links.push(o.link);
            }
          }
          notify(report, '', {
            cmd: 'open',
            links
          }, buttons.slice(0, 2));
        }
        if (prefs.alert && !hushed) {
          // new entries only, each once
          sound.play(fresh.map(([e]) => e)).catch(e => toast(e.message));
        }
        chrome.runtime.sendMessage({
          method: 'update-reset',
          data: cachedObjs
        }, () => chrome.runtime.lastError);
      }
    }
    catch (e) {
      console.error(e);
    }
  };
}

