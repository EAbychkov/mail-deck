'use strict';

const gmail = {};

/* gmail.get */
gmail.get = {
  base: url => /[^?]*/.exec(url)[0],
  id: url => {
    const tmp = /message_id=([^&]*)/.exec(url);
    if (tmp && tmp.length) {
      return tmp[1];
    }
    return null;
  }
};

/* gmail.body */
{
  // the thread's print view; a mail back from snooze answers msg= with 400, so th= gets a try too
  const print = async (url, thread) => {
    let status;
    for (const key of ['msg', 'th']) {
      const href = url + '/?ui=2&view=pt&dsqt=1&search=all&' + key + '=' + thread;
      const r = await fetch(href, {
        credentials: 'include'
      });
      if (r.ok) {
        return {href, content: await r.text()};
      }
      status = r.status;
      if (status !== 400) {
        break;
      }
    }
    throw Error('body -> print failed -> ' + status);
  };

  // The print views of the last mails opened or pointed at stay for the browser
  // session (in memory, not on disk), so such a mail opens again at once. A
  // version, the feed's time of the thread, keeps a thread with new mail apart.
  const KEEP = 12;
  const LARGEST = 800000;
  const STORE = 'print:';
  const INDEX = 'print.index';
  let writing = Promise.resolve();
  const keep = (key, value) => writing = writing.then(async () => {
    if (value.content.length > LARGEST) {
      return;
    }
    const {[INDEX]: index = []} = await chrome.storage.session.get(INDEX);
    const next = [key, ...index.filter(k => k !== key)];
    await chrome.storage.session.set({[STORE + key]: value, [INDEX]: next.slice(0, KEEP)});
    if (next.length > KEEP) {
      await chrome.storage.session.remove(next.slice(KEEP).map(k => STORE + k));
    }
  }).catch(() => {});
  const kept = key => chrome.storage.session.get(STORE + key).then(prefs => prefs[STORE + key], () => null);

  // one request per mail and panel, however many times it is pointed at or opened
  const cache = {};

  gmail.body = (link, mode, version = '') => {
    link = link.replace('http://', 'https://');

    const url = gmail.get.base(link);
    const thread = gmail.get.id(link);

    if (!thread) {
      return Promise.reject(Error('body -> Error at resolving thread. Please switch back to the summary mode.'));
    }
    const key = link + '#' + version;
    const id = key + (mode ? '#html' : '#text');
    if (!cache[id]) {
      cache[id] = (async () => {
        const saved = version ? await kept(key) : null;
        const page = saved || await print(url, thread);
        if (version && !saved) {
          keep(key, page);
        }
        return gmail.render[mode ? 'getHTMLText' : 'getPlainText'](page.content, page.href);
      })();
      cache[id].catch(() => delete cache[id]);
    }
    return cache[id];
  };

  // A mail of another service (core/services/): the background asks the service for its
  // messages, which stay for the session like a print view.
  gmail.serviceBody = (link, version = '') => {
    const key = link + '#' + version;
    const id = key + '#service';
    if (!cache[id]) {
      cache[id] = (async () => {
        const saved = version ? await kept(key) : null;
        const page = saved || await chrome.runtime.sendMessage({method: 'services.body', link}).then(r => {
          if (!Array.isArray(r?.messages)) {
            throw Error(r?.message || 'body -> service failed');
          }
          return {href: link, content: JSON.stringify(r.messages)};
        });
        if (version && !saved) {
          keep(key, page);
        }
        return gmail.render.messages(JSON.parse(page.content), link);
      })();
      cache[id].catch(() => delete cache[id]);
    }
    return cache[id];
  };
}

/* gmail.render */
{
  const SVG = 'http://www.w3.org/2000/svg';
  const XLINK = 'http://www.w3.org/1999/xlink';

  // The thread is put together in a parsed document, which shows nothing and loads nothing:
  // its pictures and media start only once the reader frame takes it. A mail pointed at is
  // built ahead of the click, and that must not tell its sender anything.
  const maker = doc => (tag, className, ...kids) => {
    const e = doc.createElement(tag);
    e.className = className;
    e.append(...kids);
    return e;
  };
  // A link of the mail opens in a tab of its own (body/index.js), never in the reader or over
  // the panel, and tells the site nothing of the page it came from
  const external = a => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    a.removeAttribute('ping');
  };

  // every message of the thread: who, when, to whom, its attachments and its body cell
  const getMessages = (content, href) => {
    const doc = new DOMParser().parseFromString(content, 'text/html');
    // the print view links relative to itself
    const base = doc.createElement('base');
    base.href = href;
    doc.head.prepend(base);

    return [...doc.querySelectorAll('table.message')].map(table => {
      const rows = [...table.rows];
      const head = rows[0];
      const body = rows.at(-1)?.cells[rows.at(-1).cells.length - 1];
      if (!head || !body || rows.length < 2) {
        return null;
      }
      for (const a of body.querySelectorAll('a[href], area[href]')) {
        // a jump inside the mail stays one
        if (!a.getAttribute('href').trim().startsWith('#')) {
          let url = a.href;
          // prevent Google redirection
          if (url.startsWith('https://www.google.com/url?q=')) {
            try {
              url = (new URL(url)).searchParams.get('q') || url;
            }
            catch (e) {}
          }
          a.setAttribute('href', url);
        }
        external(a);
      }
      for (const n of body.querySelectorAll('[contenteditable]')) {
        n.removeAttribute('contenteditable');
      }
      // Show pictures restores what the reader held, never what the mail says it held
      for (const n of body.querySelectorAll(HELD_SELECTOR)) {
        Object.keys(HELD).forEach(key => delete n.dataset[key]);
      }
      for (const img of body.querySelectorAll('img[src]')) {
        img.setAttribute('src', img.src);
      }
      const recipient = table.querySelector('.recipient');
      return {
        name: head.querySelector('b')?.textContent.trim() || head.cells[0]?.textContent.trim() || '',
        date: head.cells.length > 1 ? head.cells[head.cells.length - 1].textContent.trim() : '',
        to: recipient ? [...recipient.querySelectorAll('div')].map(d => d.textContent.trim()).filter(Boolean)
          .join('\n') || recipient.textContent.trim() : '',
        files: attachments(body),
        body
      };
    }).filter(Boolean);
  };
  // Gmail lists a file with a View and a Download link, its name in bold next to them
  const attachments = body => {
    const found = new Map();
    for (const a of body.querySelectorAll('a[href*="view=att"]')) {
      let url;
      try {
        url = new URL(a.href);
      }
      catch (e) {
        continue;
      }
      const id = url.searchParams.get('attid');
      const disp = url.searchParams.get('disp');
      if (!id || !['attd', 'safe', 'inline'].includes(disp)) {
        continue;
      }
      const o = found.get(id) || {};
      o[disp === 'attd' ? 'download' : 'view'] = url.href;
      for (let p = a.parentElement, i = 0; p && i < 5 && !o.name; p = p.parentElement, i += 1) {
        o.name = p.querySelector('b')?.textContent.trim();
      }
      found.set(id, o);
    }
    if (found.size) {
      // their links are on the chips now
      for (const table of body.querySelectorAll('table.att')) {
        if (table.previousElementSibling?.tagName === 'HR') {
          table.previousElementSibling.remove();
        }
        table.remove();
      }
    }
    return [...found.values()];
  };

  const root = (body, el) => {
    // remove extra padding
    for (const table of body.querySelectorAll('table[cellpadding="12"]')) {
      table.removeAttribute('cellpadding');
    }
    const table = el('table', 'root');
    const tr = table.ownerDocument.createElement('tr');
    table.append(tr);
    tr.append(body);
    return table;
  };
  const files = (list, el) => list.length ? el('p', 'files', ...list.map(f => {
    const a = el('a', 'file', '📎 ' + (f.name || chrome.i18n.getMessage('panel_attachment')));
    a.href = f.view || f.download;
    external(a);
    if (f.view && f.download) {
      const d = el('a', 'download', '↓');
      d.href = f.download;
      d.title = chrome.i18n.getMessage('panel_download');
      external(d);
      return el('span', 'file-pair', a, d);
    }
    return a;
  })) : '';
  const card = (m, open, el) => {
    const d = el('details', 'msg');
    d.open = open;
    d.append(
      el('summary', '',
        el('b', 'who', m.name),
        el('span', 'date', m.date),
        el('span', 'snippet', m.body.textContent.trim().replace(/\s+/g, ' ').slice(0, 160))),
      m.to ? el('p', 'to', m.to) : '',
      files(m.files, el),
      root(m.body, el)
    );
    return d;
  };

  // A service's HTML is a page of its own: what could run or leave the frame goes, and so do
  // its style sheets, which would restyle the whole reader; its links and pictures resolve
  // against the mail's page. SVG animations go too: they could point a picture elsewhere later.
  const DROP = 'script, style, iframe, frame, frameset, object, embed, applet, form, input, button, textarea, select, meta, link, base, noscript, template, animate, animateMotion, animateTransform, set, discard';
  // an SVG attribute may point outside the mail through url(), in any spelling CSS reads;
  // only a reference to a part of the mail itself, such as a gradient, stays
  const LOCAL = /^\s*url\(\s*(['"]?)#[\w.:-]*\1\s*\)[\w\s#,.%-]*$/i;
  // what the browser reads in a style attribute that can fetch, or hide what it fetches
  const FETCH = /url\(|var\(|attr\(/i;
  const remote = url => /^https?:/i.test(url);
  const sanitize = (html, href, into) => {
    const doc = new DOMParser().parseFromString(html || '', 'text/html');
    doc.querySelectorAll(DROP).forEach(n => n.remove());
    const base = doc.createElement('base');
    base.href = href;
    doc.head.prepend(base);
    const abs = value => {
      try {
        return new URL(value.trim(), href).href;
      }
      catch (e) {
        return '';
      }
    };
    for (const n of doc.querySelectorAll('*')) {
      const svg = n.namespaceURI === SVG;
      for (const {name, value} of [...n.attributes]) {
        if (/^on/i.test(name) || /^(ping|contenteditable|srcset|data-held(-poster|-href)?)$/i.test(name) ||
          (/^(href|src|xlink:href|action|formaction|background|poster)$/i.test(name) && /^\s*(javascript|vbscript|data:text\/html)/i.test(value)) ||
          (svg && name !== 'style' && /url\s*\(|\\/i.test(value) && !LOCAL.test(value))) {
          n.removeAttribute(name);
        }
      }
    }
    // links open in a tab (body/index.js); a jump inside the mail stays one
    for (const a of doc.querySelectorAll('a, area')) {
      let raw = a.getAttribute('href');
      if (a.namespaceURI === SVG) {
        raw = raw ?? a.getAttributeNS(XLINK, 'href');
        a.removeAttributeNS(XLINK, 'href');
      }
      if (raw !== null) {
        const url = raw.trim().startsWith('#') ? raw.trim() : abs(raw) || raw;
        if (/^\s*(javascript|vbscript|data:text\/html)/i.test(url)) {
          a.removeAttribute('href');
        }
        else {
          a.setAttribute('href', url);
        }
      }
      external(a);
    }
    // Gmail shows pictures through its own proxy; a service may hand the sender's addresses,
    // which tell the sender the mail was opened. Pictures, sounds, videos and the pictures of
    // an SVG wait for the reader's Show pictures (gmail.render.show).
    const hold = (n, attr, key, ns = null) => {
      const raw = n.getAttributeNS(ns, attr);
      if (raw === null || !raw.trim() || (key === 'heldHref' && raw.trim().startsWith('#'))) {
        return;
      }
      const url = abs(raw);
      if (remote(url)) {
        n.removeAttributeNS(ns, attr);
        if (n.dataset) {
          n.dataset[key] = url;
        }
      }
    };
    for (const n of doc.querySelectorAll('[src], [poster]')) {
      hold(n, 'src', 'held');
      hold(n, 'poster', 'heldPoster');
    }
    for (const n of doc.querySelectorAll('*')) {
      if (n.namespaceURI === SVG && n.localName !== 'a') {
        hold(n, 'href', 'heldHref', XLINK);
        hold(n, 'href', 'heldHref');
      }
    }
    doc.querySelectorAll('source').forEach(n => n.remove());
    for (const n of doc.querySelectorAll('[background]')) {
      n.removeAttribute('background');
    }
    // A style asks for a picture in many spellings: URL(), u\72l(), image-set('…'), a custom
    // property. The browser's own reading of it spells each as url(), so whatever it reads
    // as fetching goes, and so does any custom property or var() with it.
    for (const n of doc.querySelectorAll('[style]')) {
      const s = n.style;
      if (!s) {
        n.removeAttribute('style');
        continue;
      }
      // a longhand that reads as empty waits for a var() of its shorthand
      [...s].filter(p => p.startsWith('--') || !s.getPropertyValue(p) || FETCH.test(s.getPropertyValue(p)))
        .forEach(p => s.removeProperty(p));
      if (s.length === 0) {
        n.removeAttribute('style');
      }
    }
    const cell = into.createElement('td');
    cell.append(...doc.body.childNodes);
    return cell;
  };
  const DATE = new Intl.DateTimeFormat(chrome.i18n.getUILanguage(), {dateStyle: 'medium', timeStyle: 'short'});
  const date = iso => {
    const d = new Date(iso);
    return isNaN(d) ? '' : DATE.format(d);
  };

  // the newest message open; older ones fold to a line, a long run of them to one line
  const thread = (messages, el) => {
    if (messages.length === 0) {
      return '';
    }
    const last = messages.at(-1);
    if (messages.length === 1) {
      return el('div', 'thread single', last.to ? el('p', 'to', last.to) : '', files(last.files, el), root(last.body, el));
    }
    const older = messages.slice(0, -1);
    const shown = older.length > 3 ? older.slice(-2) : older;
    const folded = older.slice(0, older.length - shown.length);
    return el('div', 'thread',
      folded.length ? el('details', 'earlier',
        el('summary', '', chrome.i18n.getMessage('panel_earlier', [String(folded.length)])),
        ...folded.map(m => card(m, false, el))) : '',
      ...shown.map(m => card(m, false, el)),
      card(last, true, el)
    );
  };

  // what waits for Show pictures, and the attribute it goes back to
  const HELD = {held: 'src', heldPoster: 'poster', heldHref: 'href'};
  const HELD_SELECTOR = '[data-held], [data-held-poster], [data-held-href]';

  gmail.render = {
    getHTMLText(content, href) {
      const messages = getMessages(content, href);
      // the bodies stay in the print view's parsed document, and so does all around them
      return thread(messages, maker(messages[0]?.body.ownerDocument || document.implementation.createHTMLDocument('')));
    },
    // a service's messages, oldest first: {name, email, date, to, html, files: [{name, url}]}
    messages(list, href) {
      const doc = document.implementation.createHTMLDocument('');
      return thread(list.map(m => ({
        name: m.name || m.email || '',
        date: date(m.date),
        to: m.to ? chrome.i18n.getMessage('panel_to', [m.to]) || m.to : '',
        files: (m.files || []).filter(f => f?.url).map(f => ({name: f.name, view: f.url})),
        body: sanitize(m.html, href, doc)
      })), maker(doc));
    },
    held: node => Boolean(node.querySelector(HELD_SELECTOR)),
    // Show pictures: everything held loads now
    show(node) {
      for (const n of node.querySelectorAll(HELD_SELECTOR)) {
        for (const [key, attr] of Object.entries(HELD)) {
          if (key in n.dataset) {
            n.setAttribute(attr, n.dataset[key]);
            delete n.dataset[key];
          }
        }
      }
    },
    getPlainText(content, href) {
      const last = getMessages(content, href).at(-1);
      if (last) {
        const span = document.createElement('span');
        span.style['white-space'] = 'pre-line';
        span.textContent = last.body.innerText;
        return span;
      }
      return '';
    }
  };
}
