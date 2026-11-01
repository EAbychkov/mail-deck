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
