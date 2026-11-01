// Runs in the panel page next to stub.js; ?scenario= picks what to do. It reports
// what it saw to /__result, and panel.test.js decides what passes.
(async () => {
  const scenario = new URLSearchParams(location.search).get('scenario');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const key = (target, code, extra = {}) => target.dispatchEvent(new KeyboardEvent('keydown', {code, bubbles: true, cancelable: true, ...extra}));
  const sent = method => window.__sent.filter(m => m.method === method);
  const rows = () => document.querySelectorAll('#list .row').length;
  const out = {};
  const report = () => fetch('/__result?scenario=' + scenario, {method: 'POST', body: JSON.stringify(out)});
  // what the stub's mail has loaded so far, by name (panel.test.js counts it)
  const pixels = prefix => fetch('/__pixels?prefix=' + encodeURIComponent(prefix), {cache: 'no-store'}).then(r => r.json());
  const until = async (test, ms = 3000) => {
    for (const end = Date.now() + ms; Date.now() < end; await wait(25)) {
      if (test()) {
        return true;
      }
    }
    return false;
  };
  try {
    await until(() => rows() > 0 || document.querySelector('#list .acc'));
    await wait(200);

    if (scenario === 'main') {
      // the toolbar count shows all unread mail: opening the panel marks no time for it
      out.noSeen = !window.__set.some(o => 'badge.seen' in o);
      // the feed's 20, then the search's extra mail behind "show more"
      out.rowsBefore = rows();
      const more = document.querySelector('#list .section .more');
      out.moreShown = Boolean(more);
      more?.click();
      await wait(50);
      out.rowsAfterMore = rows();
      out.starred = document.querySelectorAll('#list .row .starred').length;
      out.signedOut = [...document.querySelectorAll('#list .away .acc')].map(e => e.textContent);

      // an action goes to the background at once with its Undo window; Z cancels that same one
      const before = rows();
      document.querySelector('#list .row').focus();
      key(document, 'KeyE');
      await wait(250);
      const action = sent('gmail.action').at(-1);
      out.action = action && {cmd: action.cmd, delay: action.delay, id: Boolean(action.id)};
      out.rowsAfterAction = before - rows();
      key(document, 'KeyZ');
      await wait(100);
      const cancel = sent('gmail.action.cancel').at(-1);
      out.cancelSameId = Boolean(cancel && action && cancel.id === action.id);
      out.rowsAfterUndo = rows() === before;

      // remind me later: B opens the times, the first one writes the reminder
      document.querySelector('#list .row').focus();
      key(document, 'KeyB');
      await wait(50);
      const items = [...document.querySelectorAll('#menu button')];
      out.menuItems = items.length;
      window.__set = [];
      items[0]?.click();
      await wait(250);
      const reminder = window.__set.find(o => o['remind.links'])?.['remind.links']?.[0];
      out.reminder = reminder ? Object.keys(reminder).sort() : null;
      key(document, 'KeyZ');
      await wait(100);

      // drag the second mailbox above the first: the order is saved, every mailbox keeps its colour
      const colours = () => Object.fromEntries([...document.querySelectorAll('#list .section[data-key]')]
        .map(s => [s.dataset.key, s.style.getPropertyValue('--c')]));
      const coloursBefore = colours();
      const secs = [...document.querySelectorAll('#list .section[data-key]')];
      const dt = new DataTransfer();
      const r = secs[0].getBoundingClientRect();
      (secs[1].querySelector('[draggable="true"]') || secs[1]).dispatchEvent(new DragEvent('dragstart', {bubbles: true, dataTransfer: dt}));
      secs[0].dispatchEvent(new DragEvent('dragover', {bubbles: true, cancelable: true, dataTransfer: dt, clientY: r.top + 5}));
      secs[0].dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: dt, clientY: r.top + 5}));
      await wait(100);
      out.orderBefore = secs.map(s => s.dataset.key);
      out.orderAfter = [...document.querySelectorAll('#list .section[data-key]')].map(s => s.dataset.key);
      out.orderSaved = window.__set.find(o => o.accountOrder)?.accountOrder || null;
      out.coloursKept = JSON.stringify(colours()) === JSON.stringify(Object.fromEntries(Object.keys(colours()).map(k => [k, coloursBefore[k]])));

      // the reader: the whole thread, a chip for the attachment, Google's redirect taken off
      document.querySelector('#list .row').click();
      const doc = document.getElementById('body').contentDocument;
      await until(() => doc.querySelector('.thread'));
      const msgs = [...doc.querySelectorAll('details.msg')];
      out.thread = {
        messages: msgs.length,
        lastOpen: msgs.at(-1)?.open === true,
        olderClosed: msgs.slice(0, -1).every(d => !d.open),
        to: Boolean(doc.querySelector('details[open] .to')?.textContent.trim()),
        chips: [...doc.querySelectorAll('.files a')].filter(a => a.getAttribute('href').includes('view=att')).length,
        attTableGone: !doc.querySelector('table.att'),
        redirectUnwrapped: [...doc.querySelectorAll('a')].some(a => a.getAttribute('href') === 'https://figma.com/file/x'),
        linksExternal: doc.querySelectorAll('a[href]').length >= 3 && [...doc.querySelectorAll('a[href]')]
          .every(a => a.getAttribute('target') === '_blank' && a.getAttribute('rel') === 'noopener noreferrer' && !a.hasAttribute('ping'))
      };
      out.reading = document.getElementById('app').classList.contains('reading');
      // the keys work from inside the message too
      key(doc.body, 'Escape');
      await wait(100);
      out.escInFrameBack = !document.getElementById('app').classList.contains('reading');

      // search every mailbox
      key(document, 'Slash');
      await wait(50);
      out.searchFocused = document.activeElement?.id === 'search-input';
      document.getElementById('search-input').value = 'invoice';
      document.getElementById('search').requestSubmit();
      await until(() => document.querySelector('#list .row.seen'));
      out.searchSections = document.querySelectorAll('#list .section').length;
      out.searchSeen = document.querySelectorAll('#list .row.seen').length;
      out.searchCalls = sent('gmail.search').filter(m => m.query === 'invoice').length;
    }

    if (scenario === 'speed') {
      // the first panel asks; a second one finds the answers in the session and asks nothing
      await until(() => chrome.storage.session.area['extra.cache']);
      out.firstOpenSearches = sent('gmail.search').length;
      out.cached = Object.keys(chrome.storage.session.area['extra.cache'] || {}).length;
      extraLoaded = false;
      state.extra.clear();
      const asked = sent('gmail.search').length;
      await loadExtra();
      out.secondOpenSearches = sent('gmail.search').length - asked;
      out.extraBack = [...state.extra.values()].flat().length;

      // pointing at a mail fetches it; opening it then needs no second request
      const row = document.querySelector('#list .row');
      row.dispatchEvent(new MouseEvent('mouseenter'));
      await until(() => window.__prints > 0, 1500);
      out.printsAfterHover = window.__prints;
      // it is built ahead of the click, yet its pictures wait for the reader
      await wait(400);
      out.picturesAfterHover = (await pixels('speed-gmail'))['speed-gmail'] || 0;
      row.click();
      const doc = document.getElementById('body').contentDocument;
      await until(() => doc.querySelector('.thread'));
      out.printsAfterOpen = window.__prints;
      for (const end = Date.now() + 2000; Date.now() < end && !out.picturesAfterOpen; await wait(50)) {
        out.picturesAfterOpen = (await pixels('speed-gmail'))['speed-gmail'] || 0;
      }
      out.keptForSession = (chrome.storage.session.area['print.index'] || []).length;

      // an action makes the kept answers old
      const archive = [...document.querySelectorAll('#reader-bar button')].find(b => b.title.startsWith(t('archive')));
      archive?.click();
      await wait(100);
      out.cacheDroppedAfterAction = !('extra.cache' in chrome.storage.session.area);
      // without auto-advance, the action took the reader back to the list
      out.backAfterAction = !document.getElementById('app').classList.contains('reading');
    }

    if (scenario === 'services') {
      const head = name => [...document.querySelectorAll('#list .section')].find(el => el.textContent.includes(name));
      out.meet = ['evgeny@example.com', 'ev@yahoo.com', 'ev@proton.me'].map(n => Boolean(head(n)?.querySelector('.section-head [class*="meet"], .section-head button[title*="Meet"]')));
      // sender logos come from Google: a Gmail mailbox's senders only
      out.logos = ['evgeny@example.com', 'ev@yahoo.com'].map(n => head(n)?.querySelectorAll('.row .avatar img').length);
      const yahooRow = head('ev@yahoo.com').querySelector('.row');
      out.openTitle = [...yahooRow.querySelectorAll('button')].map(b => b.title).find(t => t.includes('Yahoo')) || '';
      out.signedOut = [...document.querySelectorAll('#list .away .acc')].map(e => e.textContent);
      document.querySelector('#list .away .acc')?.click();
      await wait(50);
      out.signInOpened = sent('open').at(-1)?.url;

      // a Yahoo mail reads in the panel, with the service's markup made harmless
      yahooRow.click();
      const doc = document.getElementById('body').contentDocument;
      await until(() => doc.querySelector('.root'));
      await wait(100);
      out.bodyAsked = sent('services.body').at(-1)?.link;
      out.messages = doc.querySelectorAll('details.msg').length;
      out.safeText = doc.getElementById('safe')?.textContent || '';
      out.dangerous = doc.body.querySelectorAll('script, style, iframe, form, input, [onerror]').length + doc.body.querySelectorAll('a[href^="javascript"]').length;
      out.relative = doc.querySelector('a[href*="rel"]')?.getAttribute('href') || '';
      out.ran = window.__ran === 1;
      // remote pictures wait for the button
      out.heldBefore = doc.body.querySelectorAll('img[data-held]').length;
      out.loadedBefore = doc.body.querySelectorAll('img[src^="http"]').length;
      // and so does whatever else of the mail could load: an SVG image, a video and its poster,
      // a style's URL()
      out.heldOther = ['video[data-held]', 'video[data-held-poster]', 'svg [data-held-href]'].map(s => doc.body.querySelectorAll(s).length);
      await wait(400);
      out.pixelsBefore = await pixels('services-svc-');
      const top = doc.getElementById('top');
      out.links = {target: top?.getAttribute('target'), rel: top?.getAttribute('rel'), ping: top?.hasAttribute('ping'), editable: doc.getElementById('editable')?.hasAttribute('contenteditable')};
      doc.querySelector('.pictures button')?.click();
      out.loadedAfter = doc.body.querySelectorAll('img[src^="https://mail.yahoo.com/"]').length;
      out.barGone = !doc.querySelector('.pictures');
      for (const end = Date.now() + 2000; Date.now() < end; await wait(50)) {
        out.pixelsAfter = await pixels('services-svc-');
        if (out.pixelsAfter['services-svc-svg'] && out.pixelsAfter['services-svc-poster']) {
          break;
        }
      }
      await wait(200);
      out.pixelsAfter = await pixels('services-svc-');

      // a link of the mail opens through chrome.tabs, never over the panel or in the reader
      const created = [];
      const windows = [];
      doc.defaultView.chrome = {
        tabs: {create: o => created.push(o), query: (q, cb) => cb([{index: 2}])},
        windows: {create: o => windows.push(o)}
      };
      const click = (el, o = {}) => el.dispatchEvent(new MouseEvent(o.type || 'click', {bubbles: true, cancelable: true, button: 0, ...o}));
      top?.click();
      click(top, {ctrlKey: true});
      click(top, {type: 'auxclick', button: 1});
      click(top, {shiftKey: true});
      doc.getElementById('hash')?.click();
      doc.getElementById('data')?.click();
      await wait(300);
      out.opened = created.map(o => [o.url, o.active, o.index]);
      out.windowOpened = windows.map(o => o.url);
      out.panelStayed = location.pathname.endsWith('/__panel.html');
      out.pingAfterClicks = (await pixels('services-svc-ping'))['services-svc-ping'] || 0;
      out.star = Boolean(document.querySelector('#reader-bar .star'));
      out.noStarHint = getComputedStyle([...document.querySelectorAll('.keys > span')].find(el => el.textContent.includes('S'))).display === 'none';
      key(document, 'Escape');
      await wait(50);

      // a Proton mail opens on Proton's site: the panel cannot read it
      const opens = sent('open').length;
      head('ev@proton.me').querySelector('.row').click();
      await wait(50);
      out.protonReader = document.getElementById('app').classList.contains('reading');
      out.protonOpened = sent('open').length === opens + 1 && sent('open').at(-1).url?.link;
      // and so does Enter on it, as a click does
      head('ev@proton.me').querySelector('.row').focus();
      key(document, 'Enter');
      await wait(50);
      out.protonEnterReader = document.getElementById('app').classList.contains('reading');
      out.protonEnterOpened = sent('open').length === opens + 2 && sent('open').at(-1).url?.link;
      // pointing at a service mail fetches nothing: a service may count a fetched mail as read
      const asked = sent('services.body').length;
      head('ev@yahoo.com').querySelectorAll('.row')[1].dispatchEvent(new MouseEvent('mouseenter'));
      await wait(250);
      out.hoverFetched = sent('services.body').length - asked;

      // search asks Gmail only
      key(document, 'Slash');
      await wait(50);
      document.getElementById('search-input').value = 'invoice';
      document.getElementById('search').requestSubmit();
      await wait(150);
      out.searchUrls = sent('gmail.search').filter(m => m.query === 'invoice').map(m => m.url);

      // the Yahoo chip chosen: Yahoo cannot be searched, so Gmail is, instead of a failure
      key(document.getElementById('search-input'), 'Escape');
      await wait(50);
      [...document.querySelectorAll('#chips .chip')].find(c => c.textContent.startsWith('yahoo.com'))?.click();
      await wait(50);
      out.yahooChosen = state.only === 'https://mail.yahoo.com/n/folders/1';
      key(document, 'Slash');
      await wait(50);
      document.getElementById('search-input').value = 'receipt';
      document.getElementById('search').requestSubmit();
      await wait(150);
      out.chipSearchUrls = sent('gmail.search').filter(m => m.query === 'receipt').map(m => m.url);
      out.chipSearchFailed = document.getElementById('list').textContent.includes(t('searchFailed'));
    }

    if (scenario === 'keys') {
      // the focus, the keys and the reader. a1 a2 (and a3-a5 behind "show more") are evgeny's,
      // b1 is the only mail of work@
      const $ = id => document.getElementById(id);
      const rowOf = id => [...document.querySelectorAll('#list .row')].find(r => r.dataset.link.includes('message_id=' + id + '&'));
      const doc = $('body').contentDocument;
      const reading = () => $('app').classList.contains('reading');
      // what has the focus: a mail by its id, a button by its name
      const focus = () => {
        const el = document.activeElement;
        return el?.dataset?.link ? 'row:' + el.dataset.link.match(/message_id=([^&]*)/)[1] : el?.dataset?.focus || el?.id || el?.tagName;
      };
      const actions = (cmd, id) => sent('gmail.action').filter(a => a.cmd === cmd && a.links.some(l => l.includes('message_id=' + id + '&')));
      await until(() => [...state.extra.values()].flat().length >= 3);

      // read on open: a mail whose body did not load stays unread and listed
      state.readOnOpen = true;
      window.__printStatus = 500;
      rowOf('b1')?.click();
      await until(() => doc.querySelector('.note'));
      await wait(50);
      out.failedMarked = actions('rd', 'b1').length;
      out.failedListed = Boolean(rowOf('b1'));
      key(document, 'Escape');
      await wait(50);
      window.__printStatus = 0;
      // one that did is marked read and leaves; back from it, the next mail takes the focus
      rowOf('a2')?.focus();
      key(document, 'Enter');
      await until(() => doc.querySelector('.thread'));
      await wait(50);
      out.readMarked = actions('rd', 'a2').length;
      key(document, 'Escape');
      await wait(50);
      out.focusAfterReadOnOpen = focus();
      state.readOnOpen = false;

      // the reader takes the focus; what lies under it can be neither focused nor read out
      rowOf('a1')?.focus();
      key(document, 'Enter');
      await wait(50);
      out.readerFocused = document.activeElement === $('reader');
      out.underInert = [document.querySelector('.main > .bar'), $('chips'), $('list')].every(el => el.inert);
      key(document, 'Escape');
      await wait(50);
      out.backFocus = focus();
      out.underBack = !$('list').inert;

      // E twice, or a double click, while the mail folds away: one action, and its Undo cancels it
      rowOf('a1')?.focus();
      key(document, 'KeyE');
      await wait(60);
      key(document, 'KeyE');
      await wait(250);
      out.doubleKey = actions('rc_^i', 'a1').map(a => a.id);
      key(document, 'KeyZ');
      await wait(100);
      out.doubleKeyUndone = sent('gmail.action.cancel').at(-1)?.id === out.doubleKey[0] && Boolean(rowOf('a1'));
      const trash = rowOf('b1')?.querySelector('.acts .danger');
      trash?.click();
      await wait(60);
      trash?.click();
      rowOf('b1')?.click();
      await wait(250);
      out.doubleClick = actions('tr', 'b1').length;
      out.foldClickReads = reading();
      key(document, 'KeyZ');
      await wait(100);

      // the only mail of a mailbox archived: the focus goes to the mail before it
      rowOf('b1')?.focus();
      key(document, 'KeyE');
      await wait(300);
      out.focusAfterLast = focus();
      key(document, 'KeyZ');
      await wait(100);
      out.focusAfterUndo = focus();

      // a chip, and "show more", keep the keys where they were
      const chips = () => [...document.querySelectorAll('#chips .chip')];
      chips()[1]?.focus();
      chips()[1]?.click();
      await wait(50);
      out.focusAfterChip = focus() === chips()[1]?.dataset.focus && chips()[1].classList.contains('on');
      chips()[0]?.click();
      await wait(50);
      const more = document.querySelector('#list .more');
      more?.focus();
      more?.click();
      await wait(50);
      out.focusAfterMore = focus();

      // a check, every two minutes: a toolbar button keeps the focus, a scrolled list its place,
      // and with nothing new the list is not drawn again, yet its times move on
      const copy = () => JSON.parse(JSON.stringify(state.objs));
      const changed = () => {
        const objs = copy();
        objs[0].xml.entries[0].summary += ' ';
        return objs;
      };
      [...$('tools').querySelectorAll('.icon-btn')].find(b => b.title.startsWith(t('compose'))).focus();
      update(changed());
      out.toolKept = focus();
      const list = $('list');
      list.style.cssText = 'max-height: 160px; flex: none';
      rowOf('a1')?.focus();
      list.scrollTop = list.scrollHeight;
      const scrolled = list.scrollTop;
      update(changed());
      out.scrollKept = scrolled > 0 && list.scrollTop === scrolled;
      list.style.cssText = '';
      const line = rowOf('a1');
      line && (line.querySelector('time.when').textContent = 'stale');
      const same = copy();
      same.forEach(o => o.xml.modified = new Date().toISOString());
      update(same);
      out.sameNotDrawn = rowOf('a1') === line;
      out.timesMoved = Boolean(line) && line.querySelector('time.when').textContent !== 'stale';
      update(changed());
      out.changeDrawn = rowOf('a1') !== line;
      // the background's answer to an action comes while the mail folds: the fold goes on
      const full = copy();
      const folding = rowOf('a1');
      folding?.focus();
      key(document, 'KeyE');
      await wait(20);
      const after = copy();
      after[0].xml.entries = after[0].xml.entries.filter(e => !e.link.includes('message_id=a1&'));
      update(after);
      out.foldGoesOn = Boolean(folding?.isConnected);
      await wait(300);
      out.foldDone = Boolean(folding) && !folding.isConnected && !rowOf('a1');
      key(document, 'KeyZ');
      await wait(50);
      update(full);
      await wait(50);

      // remind me later: its focused time shows, Esc gives the focus back, Tab out closes it
      const menuItems = () => [...document.querySelectorAll('#menu button')];
      rowOf('a1')?.focus();
      key(document, 'KeyB');
      await wait(50);
      const clock = rowOf('a1')?.querySelector('.remind');
      out.menuExpanded = Boolean(clock) && clock.getAttribute('aria-haspopup') === 'menu' && clock.getAttribute('aria-expanded') === 'true';
      key(document.activeElement, 'ArrowDown');
      await wait(30);
      out.menuRing = menuItems()[1] && getComputedStyle(menuItems()[1]).outlineStyle;
      key(document.activeElement, 'Escape');
      await wait(30);
      out.menuEsc = !$('menu') && focus() === 'row:a1' && clock?.getAttribute('aria-expanded') === 'false';
      key(document, 'KeyB');
      await wait(30);
      rowOf('b1')?.focus();
      await wait(30);
      out.menuTabOut = !$('menu') && focus() === 'row:b1';
      // a larger text size: the menu still opens at its clock, inside the window
      prefsChanged({panelScale: 1.25});
      await wait(50);
      rowOf('a1')?.focus();
      key(document, 'KeyB');
      await wait(50);
      const a = rowOf('a1')?.querySelector('.remind')?.getBoundingClientRect() || {};
      const m = $('menu')?.getBoundingClientRect() || {};
      out.zoomMenu = {alignedRight: Math.abs(m.right - a.right) <= 2, inside: m.left >= 0 && m.right <= innerWidth && m.top >= 0 && m.bottom <= innerHeight,
        atClock: m.top >= a.bottom - 1 || m.bottom <= a.top + 1};
      key(document.activeElement, 'Escape');
      prefsChanged({panelScale: 1});
      await wait(50);

      // names and subjects keep their own direction: a Hebrew subject in the English panel,
      // an English one in the Hebrew panel, each with its "?" at its end and on the panel's side
      const sides = (id, title) => {
        const e = state.objs[0].xml.entries.find(x => x.link.includes('message_id=' + id + '&'));
        e.title = title;
        render();
        const el = rowOf(id).querySelector('.subject');
        const text = [...el.childNodes].find(n => n.nodeType === 3);
        const at = i => {
          const r = document.createRange();
          r.setStart(text, i);
          r.setEnd(text, i + 1);
          return r.getBoundingClientRect().left;
        };
        const box = el.getBoundingClientRect();
        return {first: at(0), mark: at(text.data.indexOf('?')), left: box.left, right: box.right};
      };
      const he = sides('a1', 'שלום, מה נשמע?');
      document.documentElement.dir = 'rtl';
      const en = sides('a1', 'Re: Meeting at 10:00?');
      document.documentElement.dir = 'ltr';
      out.bidi = {hebrewInLtr: he.mark < he.first && he.mark - he.left < 20, englishInRtl: en.mark > en.first && en.right - en.mark < 20};

      // search: an account that did not answer says so, the others show what they found
      window.__searchFails = m => m.url.endsWith('/u/0') && !m.query.includes('is:unread');
      key(document, 'Slash');
      await wait(50);
      $('search-input').value = 'invoice';
      $('search').requestSubmit();
      await until(() => !state.search?.busy);
      await wait(50);
      out.searchLines = [...document.querySelectorAll('#list .section-head')].map(h => h.querySelector('.addr')?.textContent + ': ' + h.querySelector('.none')?.textContent);
      out.searchFailedLine = out.searchLines.includes('evgeny@example.com: ' + t('searchFailed'));
      out.searchFoundLine = out.searchLines.includes('old@example.org: ' + t('found', 2));
      out.searchSaid = $('status')?.textContent === t('found', 2);
      window.__searchFails = null;
      key($('search-input'), 'Escape');
      await wait(50);
      out.focusAfterSearch = focus();
    }

    if (scenario === 'codes') {
      // a one-time code shows on its line; a click copies its digits and opens, reads or deletes nothing
      const list = () => [...document.querySelectorAll('#list .row')];
      out.pills = list().map(r => r.querySelector('.code')?.textContent || '');
      const before = rows();
      list()[0].querySelector('.code')?.click();
      await wait(50);
      out.copied = window.__copied;
      out.copiedShown = Boolean(list()[0].querySelector('.code.copied'));
      out.opened = document.getElementById('app').classList.contains('reading');
      out.actions = sent('gmail.action').length + sent('open').length;
      out.rowsKept = rows() === before;
      // C on a focused line copies its code; on a line without one, nothing
      window.__copied = null;
      list()[1].focus();
      key(document, 'KeyC');
      await wait(50);
      out.copiedByKey = window.__copied;
      window.__copied = null;
      list()[2].focus();
      key(document, 'KeyC');
      await wait(50);
      out.copiedNone = window.__copied;
      // the reader shows it too, and C copies it there
      list()[3].click();
      await wait(150);
      out.readerPill = document.querySelector('#reader-subject .code')?.textContent || '';
      key(document, 'KeyC');
      await wait(50);
      out.copiedInReader = window.__copied;
      out.actionsAfter = sent('gmail.action').length;
    }

    if (scenario === 'advance') {
      // J and K in the reader; with auto-advance an action opens the next mail. The list:
      // a1 a2 (evgeny's), b1 (work's)
      const $ = id => document.getElementById(id);
      const subject = () => $('reader-subject').firstChild?.textContent;
      document.querySelector('#list .row').click();
      await wait(150);
      out.first = subject();
      out.prevDisabledAtFirst = $('reader-bar').querySelector('.prev')?.disabled;
      key(document, 'KeyJ');
      await wait(150);
      out.afterJ = subject();
      key(document, 'KeyK');
      await wait(150);
      out.afterK = subject();
      key(document, 'KeyE');
      await wait(300);
      out.stillReading = $('app').classList.contains('reading');
      out.afterE = subject();
      out.archived = sent('gmail.action').at(-1)?.links?.[0] || '';
      out.posAfterE = $('reader-bar').querySelector('.pos')?.textContent;
      // the arrow does what J does; at the last mail J stays
      $('reader-bar').querySelector('.next')?.click();
      await wait(150);
      out.atLast = subject();
      key(document, 'KeyJ');
      await wait(150);
      out.pastLast = subject();
      out.nextDisabled = $('reader-bar').querySelector('.next')?.disabled;
      // K passes over the archived mail
      key(document, 'KeyK');
      await wait(150);
      key(document, 'KeyK');
      await wait(150);
      out.topAfterArchive = subject();
    }

    if (scenario === 'readnext') {
      // read on open takes the open mail out of the list; J still knows where it was
      const doc = document.getElementById('body').contentDocument;
      document.querySelector('#list .row').click();
      await until(() => doc.querySelector('.thread'));
      await wait(150);
      out.marked = sent('gmail.action').filter(a => a.cmd === 'rd').length;
      out.listedAfterRead = [...document.querySelectorAll('#list .row')].some(r => r.dataset.link.includes('message_id=a1&'));
      key(document, 'KeyJ');
      await wait(150);
      out.afterJ = document.getElementById('reader-subject').firstChild?.textContent;
    }

    if (scenario === 'seen') {
      // the toolbar count at "mail since the panel was last opened": opening the panel marks the
      // time; a list update, which the background sends for that very mark, does not
      out.seen = window.__set.some(o => 'badge.seen' in o);
      window.__set = [];
      update(JSON.parse(JSON.stringify(state.objs)));
      await wait(100);
      out.seenOnUpdate = window.__set.some(o => 'badge.seen' in o);
    }

    if (scenario === 'site') {
      // mail from the site of the page the panel opened over (?url=https://github.com/login)
      const $ = id => document.getElementById(id);
      const block = () => $('list').querySelector(':scope > .site');
      const id = link => link.match(/message_id=([^&]*)/)[1];
      const pins = () => [...(block()?.querySelectorAll('.pin') || [])].map(p => id(p.dataset.focus));
      const goTo = async url => {
        window.__tabUrl = url;
        window.__tabEvents.updated?.(7, {url, status: 'complete'}, {id: 7, active: true, windowId: 1});
        await wait(80);
      };
      await until(() => block());
      out.first = $('list').firstElementChild === block();
      out.head = block().querySelector('.site-head').textContent === t('fromSite', 'github.com');
      // newest first, three of the five, the bulk sender's and the other mailbox's among them
      out.pins = pins();
      out.more = block().querySelector('.site-more')?.textContent === t('siteMore', 2);
      out.pinsNamed = [...block().querySelectorAll('.pin')].every(p => p.tagName === 'BUTTON' && p.textContent.trim() && p.title);
      out.noRows = block().querySelectorAll('.row, [data-link]').length === 0;
      // the code, large and grouped; a click copies its digits, says so, and leaves the mail as it was
      const code = block().querySelector('.site-code');
      out.codeShown = code?.querySelector('.digits').textContent === '482 913';
      const acted = window.__sent.filter(m => m.method === 'gmail.action').length;
      code?.click();
      await wait(50);
      out.codeCopied = window.__copied === '482913' && $('toast').textContent === t('codeCopied');
      // C copies it: with no line focused, and from a line without a code of its own
      window.__copied = null;
      document.activeElement.blur();
      key(document, 'KeyC');
      await wait(30);
      out.keyNoFocus = window.__copied === '482913';
      window.__copied = null;
      [...document.querySelectorAll('#list .row')].find(r => id(r.dataset.link) === 'f1').focus();
      key(document, 'KeyC');
      await wait(30);
      out.keyPlainLine = window.__copied === '482913';
      // a line with its own code keeps C for it
      window.__copied = null;
      [...document.querySelectorAll('#list .row')].find(r => id(r.dataset.link) === 'f2').focus();
      key(document, 'KeyC');
      await wait(30);
      out.keyOwnCode = window.__copied === '7310';
      // and typing in the search copies nothing
      window.__copied = null;
      key(document, 'Slash');
      await wait(30);
      key($('search-input'), 'KeyC');
      await wait(30);
      out.keyInSearch = window.__copied === null && !block();
      key($('search-input'), 'Escape');
      await wait(50);
      out.backAfterSearch = Boolean(block());
      out.noAction = window.__sent.filter(m => m.method === 'gmail.action').length === acted;

      // a pin opens its mail in the reader; back, the pin has the focus again
      block().querySelector('.pin').click();
      await wait(50);
      out.pinReads = state.reading && id(state.reading.e.link) === 'g1';
      key(document, 'Escape');
      await wait(50);
      out.pinFocusBack = document.activeElement?.dataset?.focus === block()?.querySelector('.pin').dataset.focus;

      // "2 more" narrows the list to the site's mail, in its mailboxes; Esc lets go
      block().querySelector('.site-more').click();
      await wait(50);
      out.narrowed = [...document.querySelectorAll('#list .row')].map(r => id(r.dataset.link)).sort();
      out.narrowChip = $('chips').querySelector('.site-chip')?.textContent === 'github.com' && !block();
      key(document, 'Escape');
      await wait(50);
      out.letGo = Boolean(block()) && !$('chips').querySelector('.site-chip') && document.querySelectorAll('#list .row').length === 10;

      // the side panel follows its tab: chrome://, Gmail itself and a site without mail show nothing;
      // another ending of the brand does (its code too old to show); a generic brand does not
      await goTo('chrome://extensions/');
      out.chromePage = !block();
      await goTo('https://github.com/settings/keys');
      out.backOnGithub = Boolean(block());
      await goTo('https://mail.google.com/mail/u/0/#inbox');
      out.gmailHost = !block();
      await goTo('https://www.amazon.co.uk/gp/your-account');
      out.amazon = {pins: pins(), code: Boolean(block()?.querySelector('.site-code')), head: block()?.querySelector('.site-head').textContent === t('fromSite', 'amazon.co.uk')};
      await goTo('https://www.store.com/checkout');
      out.generic = !block();
      await goTo('https://example.org/');
      out.noMatch = !block();
      window.__tabUrl = 'https://github.com/';
      window.__tabEvents.activated?.({tabId: 7, windowId: 1});
      await wait(80);
      out.onActivated = Boolean(block());

      // the keys of a site: endings, webmail, people's own mail
      const of = url => siteOf(url)?.domain ?? null;
      out.sites = ['https://www.bbc.co.uk/news', 'https://www.bmw.de/', 'https://shop.example.com.br/x', 'https://e.mail.ru/inbox',
        'https://outlook.live.com/mail/', 'http://192.168.1.1/', 'https://gmail.com/', 'file:///tmp/x.html'].map(of);
      const brand = (email, url) => siteOf(url) ? ofSite({author_email: email}, siteOf(url)) : null;
      out.brands = [brand('service@paypal.de', 'https://www.paypal.com/signin'), brand('news@apps.de', 'https://apps.com/'),
        brand('hi@mail.de', 'https://mail-shop.com/'), brand('x@gmail.com', 'https://gmail.co.uk/')];

      // what it costs, from data in memory: nine mailboxes of twenty
      const many = Array.from({length: 9}, (_, i) => ({...state.objs[0], xml: {...state.objs[0].xml, link: 'm' + i,
        entries: Array.from({length: 20}, (_, j) => ({...state.objs[0].xml.entries[j % 9], link: `l${i}-${j}`}))}}));
      const t0 = performance.now();
      for (let i = 0; i < 20; i += 1) {
        siteMail(state.site, many);
      }
      out.ms = (performance.now() - t0) / 20;
    }

    if (scenario === 'narrow') {
      // a side panel 320px wide: the mailbox line keeps its buttons whole and its address
      // readable, the reader's bar stays inside
      const head = document.querySelector('#list .section-head');
      const shown = el => getComputedStyle(el).display !== 'none';
      out.width = innerWidth;
      out.buttons = [...head.querySelectorAll('.icon-btn')].filter(shown).map(b => b.dataset.focus + ':' + Math.round(b.getBoundingClientRect().width));
      out.addr = Math.round(head.querySelector('.addr').getBoundingClientRect().width);
      document.querySelector('#list .row').click();
      await wait(350);
      const bar = document.getElementById('reader-bar');
      out.barInside = bar.scrollWidth <= bar.clientWidth && [...bar.querySelectorAll('.icon-btn')].at(-1).getBoundingClientRect().right <= bar.getBoundingClientRect().right;
    }

    if (scenario === 'wide') {
      // a 700px newsletter fits the reader without a sideways scroll
      document.querySelector('#list .row').click();
      const doc = document.getElementById('body').contentDocument;
      await until(() => doc.querySelector('.root'));
      await wait(400);
      out.scrollWidth = doc.documentElement.scrollWidth;
      out.clientWidth = doc.documentElement.clientWidth;
    }
  }
  catch (e) {
    out.error = String(e && e.stack || e);
  }
  report();
})();
