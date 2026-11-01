/* global Resolved, Remind, gmail */
'use strict';

// One colour per mailbox, in the order Google lists the signed-in accounts
const PALETTE = ['#3567e6', '#169b62', '#d9822b', '#d23f3a', '#8b55d9', '#138fa8', '#c9447f', '#5e7a1f', '#a8612a', '#4f5b6b'];
const ICONS = {
  refresh: ['M20 12a8 8 0 1 1-2.34-5.66', 'M20 4v5h-5'],
  open: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  compose: ['M12 20h8', 'M16.5 3.6a2.1 2.1 0 0 1 3 3L7.5 18.6 4 19.5l.9-3.5Z'],
  tune: ['M4 7h9', 'M17 7h3', 'M13 7a2 2 0 1 0 4 0a2 2 0 1 0-4 0', 'M4 17h3', 'M11 17h9', 'M7 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0'],
  read: ['M3 10l9-6 9 6v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z', 'M3 10l9 6 9-6'],
  readAll: ['M2 12.5l4.5 4.5L16 7.5', 'M11.5 16.5l.5.5L21.5 7.5'],
  archive: ['M4.5 4h15A1.5 1.5 0 0 1 21 5.5v2A1.5 1.5 0 0 1 19.5 9h-15A1.5 1.5 0 0 1 3 7.5v-2A1.5 1.5 0 0 1 4.5 4Z', 'M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9', 'M10 13h4'],
  trash: ['M4 7h16', 'M6.5 7l.9 12a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12', 'M9.5 7V4.5h5V7'],
  spam: ['M12 3l8 3.5v5.5c0 4.5-3.4 7.7-8 9-4.6-1.3-8-4.5-8-9V6.5Z', 'M12 8.5v4', 'M12 15.8v.2'],
  back: ['M15 5l-7 7 7 7'],
  up: ['M6 15l6-6 6 6'],
  down: ['M6 9l6 6 6-6'],
  done: ['M4 12.5l5 5L20 6.5'],
  copy: ['M11 9h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z', 'M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3'],
  reply: ['M9.5 14.5L4 9l5.5-5.5', 'M4 9h10a6 6 0 0 1 6 6v4'],
  star: ['M12 3.6l2.55 5.2 5.7.83-4.13 4.02.98 5.68L12 16.65l-5.1 2.68.98-5.68-4.13-4.02 5.7-.83Z'],
  meet: ['M4.5 6h9A1.5 1.5 0 0 1 15 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 16.5v-9A1.5 1.5 0 0 1 4.5 6Z', 'M15 10.5l5.2-3.1a.5.5 0 0 1 .8.43v8.34a.5.5 0 0 1-.8.43L15 13.5'],
  mail: ['M4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5Z', 'M3.5 7l8.5 6 8.5-6'],
  search: ['M10.5 17a6.5 6.5 0 1 0 0-13a6.5 6.5 0 0 0 0 13Z', 'M15.5 15.5L20 20'],
  close: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'],
  addUser: ['M10 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7Z', 'M3.5 20c.7-3.4 3.3-5.5 6.5-5.5 1.5 0 2.9.4 4 1.2', 'M18.5 14v6', 'M15.5 17h6'],
  clock: ['M12 20.5a8.5 8.5 0 1 0 0-17a8.5 8.5 0 0 0 0 17Z', 'M12 7.5V12l3 2'],
  side: ['M4.5 4h15A1.5 1.5 0 0 1 21 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-13A1.5 1.5 0 0 1 4.5 4Z', 'M15 4v16'],
  grip: ['M9 6h.01', 'M9 12h.01', 'M9 18h.01', 'M15 6h.01', 'M15 12h.01', 'M15 18h.01']
};
// the strings live in _locales as panel_*; a language without one falls back to English
const t = (key, ...subs) => chrome.i18n.getMessage('panel_' + key, subs.map(String)) || key;
const LANG = chrome.i18n.getUILanguage();
const ACTIONS = {
  'rd': {icon: 'read', title: t('markRead') + ' (R)', done: t('doneRead')},
  'rc_^i': {icon: 'archive', title: t('archive') + ' (E)', done: t('doneArchive')},
  'tr': {icon: 'trash', title: t('delete') + ' (Delete)', done: t('doneDelete'), danger: true},
  'sp': {icon: 'spam', title: t('spam') + ' (!)', done: t('doneSpam'), danger: true}
};
// how long an action waits for its Undo before it reaches Gmail
const UNDO_MS = 5000;
// Mailboxes whose senders share one domain; their logo says nothing about the sender
const FREEMAIL = /^(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|icloud|me|mail|yandex|ya|proton|protonmail|pm|aol|gmx|inbox|bk|list|rambler)\./;
const ADD_ACCOUNT = 'https://accounts.google.com/AddSession?continue=https://mail.google.com/mail/';
// the side panel loads side.html, which comes here with ?side: that panel stays open after a click
const SIDE = new URLSearchParams(location.search).has('side');

const $ = id => document.getElementById(id);
// a mail's line in the list
const rowOf = link => $('list').querySelector(`.row[data-link="${CSS.escape(link)}"]`);
// state.focus is a link, or this: the first line of the list, when no mail is left to go to
const FIRST = Symbol('first');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const dark = matchMedia('(prefers-color-scheme: dark)');

const state = {
  objs: [], // the accounts as the background published them
  hidden: new Set(), // links acted on here, until the feed stops listing them
  reading: null, // {e, o, next, code}
  // the list's mail as the reader found it, link -> {e, o}: J and K walk it, though mail read on
  // opening has left the list by then
  trail: null,
  autoAdvance: false, // an action in the reader opens the next mail instead of the list
  badgeNew: false, // the toolbar count shows the mail since the panel was last opened
  focus: null, // the line the next drawing gives the focus to: a link, or FIRST
  only: null, // the mailbox the chips narrowed the list to
  rows: new Map(), // link -> {e, o}
  pending: null, // the action waiting for its Undo: {cmd, links, ready, timer}
  // threads with a star; the feed does not tell, Gmail's search does
  starred: new Set(),
  // what the feed leaves out: its 20 entries are all it lists of a mailbox. link of the mailbox -> entries
  extra: new Map(),
  expanded: new Set(), // mailboxes showing their extra mail
  search: null, // {q, busy, results: [{o, entries, failed}]}
  accounts: {}, // every address the extension has seen, with its settings
  order: [], // the mailboxes, by name, in the order they were dragged to
  drag: null, // the name of the mailbox being dragged
  readOnOpen: false,
  senderLogos: true, // the settings may turn the logos off; they come from Google's icon service
  avatars: {}, // address -> {url}: the accounts' own pictures
  windowId: null
};
let refreshing = false;

const h = (tag, props, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') {
      el.className = v;
    }
    else if (k === 'style') {
      el.style.cssText = v;
    }
    else if (k.startsWith('data-') || k.startsWith('aria-') || k === 'role') {
      el.setAttribute(k, v);
    }
    else {
      el[k] = v;
    }
  }
  el.append(...kids.flat().filter(k => k !== null && k !== undefined && k !== false));
  return el;
};
const icon = name => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name].map(d => `<path d="${d}"/>`).join('');
  return svg;
};
// data-focus names the button, so it gets the focus back once the list is drawn again
const btn = (name, title, onclick, extra = '') => h('button', {
  class: 'icon-btn ' + extra,
  type: 'button',
  title,
  'aria-label': title,
  'data-focus': name,
  onclick: ev => {
    ev.stopPropagation();
    onclick(ev);
  }
}, icon(name));
// a check stands in for the icon for a moment, so a copy needs no look at the toast
const copyBtn = text => btn('copy', t('copyAddress'), ev => {
  const el = ev.currentTarget;
  navigator.clipboard.writeText(text).then(() => {
    el.replaceChildren(icon('done'));
    el.classList.add('copied');
    setTimeout(() => {
      el.replaceChildren(icon('copy'));
      el.classList.remove('copied');
    }, 1200);
  }, () => toast(t('copyFailed'), true));
}, 'copy');

/* one-time codes: a sign-in or verification code in a mail, a click from the clipboard */
// a word that names a code, in the languages the panel speaks and a few more
const CODE_WORDS = /code|passcode|\bpin\b|\botp\b|2fa|verif|one[- ]time|security|confirm|код|пароль|подтвержд|kod|código|codice|kód|κωδικ|קוד|رمز|验证码|驗證碼|認証|確認コード|인증/i;
// 4-8 digits, or 3+3 split by a dash or a space, maybe after a prefix like G-; never part of a longer
// number, an amount, a date, a time, an address, a word or a phone number. A full stop after it is fine.
const CODE_NUMBER = /(?<![\p{L}\p{N}#№$€£¥₽/+@_-]|\p{N}[ .,:-])(?:\p{Lu}{1,3}-)?(\d{3}[- ]\d{3}|\d{4,8})(?![\p{L}\p{N}%@_/$€£¥₽]|[- .,:]\p{N})/gu;
// The one-time code a text names: {shown, copy}, shown as the mail writes it (G-482913, 123-456)
// and copy its digits alone, or null. A year is no code; of several, six digits win.
const codeOf = text => {
  text = String(text || '');
  if (!CODE_WORDS.test(text)) {
    return null;
  }
  const found = [...text.matchAll(CODE_NUMBER)].map(m => m[0]).filter(s => !/^(19|20)\d\d$/.test(s));
  const pick = found.find(s => s.replace(/\D/g, '').length === 6) || found[0];
  return pick ? {shown: pick, copy: pick.replace(/\D/g, '')} : null;
};
// copying marks nothing read and deletes nothing: the mail stays as it was
const copyCode = (code, el) => navigator.clipboard.writeText(code.copy).then(() => {
  el?.classList.add('copied');
  setTimeout(() => el?.classList.remove('copied'), 1200);
}, () => toast(t('copyCodeFailed'), true));
const codePill = code => h('button', {
  'class': 'code',
  'type': 'button',
  'title': t('copyCode') + ' (C)',
  'aria-label': t('copyCode') + ' ' + code.shown,
  'data-focus': 'code',
  // the pill is not the mail: a click on it opens nothing
  'onclick': ev => {
    ev.stopPropagation();
    copyCode(code, ev.currentTarget);
  }
}, code.shown);

const when = iso => {
  const d = new Date(iso);
  if (isNaN(d)) {
    return '';
  }
  const now = new Date();
  const mins = (now - d) / 60000;
  if (mins < 1) {
    return t('now');
  }
  if (mins < 60) {
    return t('minutes', Math.floor(mins));
  }
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(LANG, {hour: 'numeric', minute: '2-digit'});
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return t('yesterday');
  }
  return d.toLocaleDateString(LANG, d.getFullYear() === now.getFullYear() ? {day: 'numeric', month: 'short'} : {});
};
const fullDate = iso => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString(LANG, {dateStyle: 'long', timeStyle: 'short'});
};
// a reminder's moment: the time today, the day and the time later on
const later = ms => {
  const d = new Date(ms);
  return d.toLocaleString(LANG, d.toDateString() === new Date().toDateString() ?
    {hour: 'numeric', minute: '2-digit'} : {weekday: 'short', hour: 'numeric', minute: '2-digit'});
};

// the account's own picture when Google has one (core/avatars.js finds it), the coloured dot otherwise
const mark = email => {
  const url = state.avatars[email]?.url;
  return url ? h('img', {
    class: 'me',
    src: url,
    alt: '',
    referrerPolicy: 'no-referrer',
    onerror: ev => ev.target.replaceWith(h('span', {class: 'dot'}))
  }) : h('span', {class: 'dot'});
};
// domain -> whether it has a logo, kept for the browser session
const logos = new Map();
// The icon service is Google's, and it answers without CORS, so the request carries the
// Google cookies: a mailbox of another service (Proton, Yandex...) shows the letter only,
// and its senders stay unknown to Google.
const avatar = (e, o) => {
  const name = e.author_name || e.author_email || '';
  const hash = [...(e.author_email || name)].reduce((p, c) => (p * 31 + c.charCodeAt(0)) >>> 0, 0);
  const el = h('span', {class: 'avatar', style: `--c:${PALETTE[hash % PALETTE.length]}`},
    (name.match(/[\p{L}\p{N}]/u) || ['?'])[0].toUpperCase());
  const parts = ((e.author_email || '').split('@')[1] || '').toLowerCase().split('.');
  // keep the registrable part: news.binance.com -> binance.com, mail.example.co.uk -> example.co.uk
  const root = parts.slice(parts.length > 2 && parts.at(-2).length <= 3 && parts.at(-1).length === 2 ? -3 : -2).join('.');
  if (state.senderLogos && !serviceOf(o) && root.includes('.') && !FREEMAIL.test(root) && logos.get(root) !== false) {
    const img = h('img', {alt: '', referrerPolicy: 'no-referrer'});
    // the service answers an unknown domain with a 16px globe
    img.onload = () => {
      const has = img.naturalWidth >= 32;
      el.classList.toggle('logo', has);
      if (logos.get(root) !== has) {
        logos.set(root, has);
        chrome.storage.session.set({logos: Object.fromEntries(logos)});
      }
    };
    img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(root)}&sz=64`;
    // a logo seen before shows from the first frame instead of after the letter
    el.classList.toggle('logo', logos.get(root) === true);
    el.append(img);
  }
  return el;
};

const accountName = o => o.xml.title + (o.xml.label ? ` [${o.xml.label}]` : '');
// a mailbox of another service than Gmail (core/services/), and what it can do: Gmail can all
const serviceOf = o => o?.xml.service ? self.MailServices?.[o.xml.service] : undefined;
const can = (o, what) => {
  const s = serviceOf(o);
  return !s || Boolean(s.can?.[what]);
};
const openIn = o => serviceOf(o) ? t('openIn', serviceOf(o).name) : t('openInGmail');
const openInbox = o => serviceOf(o) ? t('openInboxIn', serviceOf(o).name) : t('openInbox');

// the accounts with what this panel already acted on taken out, in the order they were
// dragged to; a mailbox keeps its colour wherever it goes, a new one comes last
const view = () => {
  const objs = Resolved.apply(state.objs, [...state.hidden].map(link => ({link})))
    .map((o, i) => ({...o, color: PALETTE[i % PALETTE.length]}));
  const place = o => {
    const i = state.order.indexOf(accountName(o));
    return i === -1 ? state.order.length + objs.indexOf(o) : i;
  };
  return objs.filter(o => o.meta?.ignored !== true).sort((a, b) => place(a) - place(b));
};
// a thread is the same in the feed and in Gmail's search, their links are not
const thread = link => gmail.get.id(link) || link;

const gmailLink = (e, o) => {
  const id = gmail.get.id(e.link);
  if (!id) {
    return e.link;
  }
  return o.xml.link.includes('#') ? o.xml.link + '/' + id : gmail.get.base(e.link) + '/?shva=1#inbox/' + id;
};
const openUrl = url => chrome.runtime.sendMessage({method: 'open', url}, () => {
  chrome.runtime.lastError;
  if (!SIDE) {
    window.close();
  }
});
const openEntry = (e, o, ev) => {
  const background = ev && (ev.button === 1 || ev.metaKey || ev.ctrlKey);
  chrome.runtime.sendMessage({
    method: 'open',
    url: {link: gmailLink(e, o), button: background ? 1 : 0}
  }, () => {
    chrome.runtime.lastError;
    if (!background && !SIDE) {
      window.close();
    }
  });
};
// the account number Gmail puts in its links: mail/u/1/...
const userOf = link => (link.match(/u\/(\d+)/) || [])[1] || 0;
// Gmail has no link that opens a reply to a thread, so the compose window gets the sender and the subject
const replyUrl = (e, o) => {
  const subject = e.title || '';
  const su = /^re:/i.test(subject) ? subject : 'Re: ' + subject;
  const s = serviceOf(o);
  if (s) {
    return s.compose(e.author_email, su);
  }
  return `https://mail.google.com/mail/u/${userOf(e.link)}/?view=cm&fs=1&to=${encodeURIComponent(e.author_email)}&su=${encodeURIComponent(su)}`;
};
// new mail goes out from the mailbox in view: the open message's, the chosen chip's, or the first one
const composeFrom = objs => state.reading?.o || objs.find(o => o.xml.link === state.only) || objs[0];
const composeUrl = o => serviceOf(o)?.compose() || `https://mail.google.com/mail/u/${o ? userOf(o.xml.link) : 0}/?view=cm&fs=1`;
// meet.google.com/new starts a meeting at once; authuser picks the account by its address
const meetUrl = o => 'https://meet.google.com/new?authuser=' + encodeURIComponent(o.xml.title);
const signInUrl = email => self.MailServices?.[state.accounts[email]?.service]?.signIn ||
  'https://accounts.google.com/AccountChooser?Email=' + encodeURIComponent(email) +
  '&continue=' + encodeURIComponent('https://mail.google.com/mail/');
const searchUrl = (o, q) => `https://mail.google.com/mail/u/${userOf(o.xml.link)}/#search/${encodeURIComponent(q)}`;

/* Gmail's search: what the feed does not say */
// its rows become feed entries, so the list, the reader and the actions take them as they are
const fromSearch = (a, o) => {
  const strings = [a.from].flat(Infinity).filter(s => typeof s === 'string' && s);
  const pair = strings.length === 1 && /^(.*?)\s*<([^>]+)>$/.exec(strings[0]);
  const email = pair ? pair[2] : strings.find(s => s.includes('@')) || '';
  const name = pair ? pair[1] : strings.find(s => !s.includes('@')) || email;
  // seconds, milliseconds or microseconds
  let date = Number(a.date) || 0;
  date = date > 1e14 ? date / 1000 : date < 1e11 ? date * 1000 : date;
  const labels = a.labels || [];
  return {
    link: `${o.xml.rootLink.replace(/\/$/, '')}?message_id=${a.thread}&view=conv&extsrc=atom`,
    id: 'search:' + a.thread,
    title: a.subject || '',
    summary: a.text || '',
    author_name: name,
    author_email: email,
    modified: date ? new Date(date).toISOString() : '',
    unread: labels.includes('^u'),
    starred: labels.includes('STARRED')
  };
};
// Gmail may not answer at all; the panel does not wait longer than this
const SEARCH_MS = 8000;
const searchIn = (o, query) => Promise.race([
  chrome.runtime.sendMessage({method: 'gmail.search', url: o.xml.rootLink, query}),
  new Promise(resolve => setTimeout(resolve, SEARCH_MS, null))
]).then(entries => Array.isArray(entries) ? entries.map(a => fromSearch(a, o)) : null, () => null);
// the search that lists what a mailbox's feed lists
const unreadQuery = o => {
  if (serviceOf(o)) {
    return null;
  }
  const label = o.xml.label;
  if (!label) {
    return 'in:inbox is:unread';
  }
  if (label.startsWith('^')) {
    return label === '^smartlabel_personal' ? 'in:inbox category:primary is:unread' : null;
  }
  return 'label:' + label.toLowerCase().replace(/[\s/&]+/g, '-') + ' is:unread';
};
// once a panel: the stars, and the unread mail past the feed's 20. What the search
// found stays a few minutes for a mailbox whose count has not moved, so a panel
// opened again shows it at once and asks Gmail nothing.
const EXTRA = 'extra.cache';
const EXTRA_MS = 3 * 60 * 1000;
let extraLoaded = false;
// an action here makes the answers old; the next panel asks again
const forgetExtra = () => {
  extraLoaded = 'stale';
  chrome.storage.session.remove(EXTRA);
};
const loadExtra = async () => {
  if (extraLoaded || state.objs.length === 0) {
    return;
  }
  extraLoaded = true;
  const {[EXTRA]: saved = {}} = await chrome.storage.session.get(EXTRA);
  const kept = {};
  const use = (o, entries) => {
    entries.filter(e => e.starred).forEach(e => state.starred.add(thread(e.link)));
    const listed = new Set(o.xml.entries.map(e => thread(e.link)));
    state.extra.set(o.xml.link, entries.filter(e => !listed.has(thread(e.link))));
  };
  const asks = [];
  for (const o of state.objs) {
    const query = unreadQuery(o);
    if (!query || !o.xml.fullcount || o.meta?.ignored) {
      continue;
    }
    const old = saved[o.xml.link];
    if (old && Date.now() - old.at < EXTRA_MS && old.fullcount === o.xml.fullcount) {
      use(o, old.entries);
      kept[o.xml.link] = old;
      continue;
    }
    asks.push(searchIn(o, query).then(entries => {
      if (entries) {
        use(o, entries);
        kept[o.xml.link] = {at: Date.now(), fullcount: o.xml.fullcount, entries};
      }
    }));
  }
  if (Object.keys(kept).length) {
    render();
    paintStar();
  }
  if (asks.length) {
    await Promise.all(asks);
    render();
    paintStar();
  }
  if (extraLoaded === true) {
    chrome.storage.session.set({[EXTRA]: kept});
  }
};

/* toast */
let toastTimer;
const hideToast = () => $('toast').classList.remove('show');
const toast = (text, error, undo) => {
  const el = $('toast');
  el.replaceChildren(text, undo ? h('button', {
    class: 'undo',
    type: 'button',
    title: t('undo') + ' (Z)',
    onclick: undo
  }, t('undo')) : '');
  el.classList.toggle('error', Boolean(error));
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, undo ? UNDO_MS : error ? 4000 : 1800);
};

/* actions */
// archive and spam are not every service's
const allowed = (cmd, o) => (cmd !== 'rc_^i' || can(o, 'archive')) && (cmd !== 'sp' || can(o, 'spam'));
// Gmail accepts an action only with the GMAIL_AT cookie, which its print view sets
const ensureAt = async link => {
  const n = (link.match(/u\/(\d+)/) || [])[1];
  const at = await chrome.runtime.sendMessage({method: 'get-at', n}).catch(() => null);
  if (!at) {
    await gmail.body(link, true).catch(() => {});
  }
};
// the background waits out the Undo window (delay) itself: the panel may close any moment
const send = ({cmd, links, id}, delay = 0) => chrome.runtime.sendMessage({method: 'gmail.action', cmd, links, id, delay}, failure => {
  if (chrome.runtime.lastError || failure) {
    links.forEach(link => state.hidden.delete(link));
    render();
    toast(t('actionFailed'), true);
  }
});
// the Undo is gone: the action stays as it is
const commit = p => {
  if (state.pending === p) {
    state.pending = null;
    clearTimeout(p.timer);
  }
};
const undo = () => {
  const p = state.pending;
  if (!p) {
    return;
  }
  state.pending = null;
  clearTimeout(p.timer);
  hideToast();
  if (p.cmd === 'remind') {
    Remind.remove(p.links);
  }
  else {
    chrome.runtime.sendMessage({method: 'gmail.action.cancel', id: p.id});
  }
  p.links.forEach(link => state.hidden.delete(link));
  state.focus = p.links[0];
  foldUntil = 0;
  render();
};
// the line that takes the place of these mails: the next one left, else the one before
const neighbour = links => {
  const all = [...$('list').querySelectorAll('.row')];
  const at = all.findLastIndex(r => links.includes(r.dataset.link));
  const left = r => !links.includes(r.dataset.link) && !state.hidden.has(r.dataset.link);
  return at === -1 ? null : all.slice(at + 1).find(left) || all.slice(0, at).reverse().find(left) || null;
};
// a list drawn while mail folds away would cut the fold short; the fold draws it when done
let foldUntil = 0;
const act = (cmd, links, until) => {
  // a second click, or the key pressed twice, while the mail folds away: it has its action
  // already, and a second one would outlive the Undo of the first
  links = links.filter(link => !state.pending?.links.includes(link));
  if (links.length === 0) {
    return;
  }
  // one Undo at a time: the action before this one is final now
  if (state.pending) {
    commit(state.pending);
  }
  const rows = links.map(rowOf).filter(Boolean);
  // the focus goes to the mail that takes their place; from the reader, to the line back()
  // focused; with no mail left, to the first line of the list
  const active = document.activeElement?.closest?.('#list .row');
  const next = neighbour(links) || (active && !links.includes(active.dataset.link) && !state.hidden.has(active.dataset.link) ? active : null);
  state.focus = next ? next.dataset.link : FIRST;

  links.forEach(link => state.hidden.add(link));
  forgetExtra();
  const duration = reducedMotion ? 0 : 180;
  foldUntil = performance.now() + duration;
  rows.forEach(el => el.animate([
    {height: el.offsetHeight + 'px', opacity: 1},
    {height: '0px', opacity: 0, paddingTop: 0, paddingBottom: 0}
  ], {duration, easing: 'ease-in', fill: 'forwards'}));
  setTimeout(render, duration);

  const p = {cmd, links, id: Math.random().toString(36).slice(2)};
  if (cmd === 'remind') {
    // the background keeps it out of the badge and rings when its time comes
    Remind.add(links.map(link => {
      const {e, o} = state.rows.get(link) || {};
      return {link, open: e ? gmailLink(e, o) : link, title: e?.title || '', from: e?.author_name || e?.author_email || ''};
    }), until);
  }
  else {
    send(p, UNDO_MS);
  }
  p.timer = setTimeout(() => commit(p), UNDO_MS);
  state.pending = p;
  const many = links.length > 1 ? links.length : '';
  toast(cmd === 'remind' ? t('doneRemind', later(until)) + (many && ` · ${many}`) : ACTIONS[cmd].done + (many && `: ${many}`), false, undo);
};
const paintStar = () => {
  const el = $('reader-bar').querySelector('.star');
  if (el && state.reading) {
    const on = state.starred.has(thread(state.reading.e.link));
    el.classList.toggle('on', on);
    el.title = el.ariaLabel = on ? t('unstar') : t('star');
  }
};
const star = e => {
  const key = thread(e.link);
  const on = !state.starred.has(key);
  forgetExtra();
  const paint = on => {
    state.starred[on ? 'add' : 'delete'](key);
    paintStar();
    render();
  };
  paint(on);
  ensureAt(e.link).then(() => chrome.runtime.sendMessage({method: 'gmail.action', cmd: on ? 'st' : 'xst', links: [e.link]}, failure => {
    if (chrome.runtime.lastError || failure) {
      paint(!on);
      toast(t('starFailed'), true);
    }
  }));
};

/* remind me later: a short menu of times under the clock */
// the clock the menu opened from; Esc gives it the focus back, or its mail's line
let menuFrom = null;
const closeMenu = (refocus = false) => {
  const from = menuFrom;
  const menu = $('menu');
  menuFrom = null;
  // its id goes first: the removal blurs its focused item, and that focusout must not close it twice
  menu?.removeAttribute('id');
  menu?.remove();
  from?.setAttribute('aria-expanded', 'false');
  if (refocus && from?.isConnected) {
    (from.closest('.row') || from).focus({preventScroll: true});
  }
};
const remindMenu = (anchor, links) => {
  closeMenu();
  // focusable itself, so a click on its title or edge keeps the focus inside
  const menu = h('div', {class: 'menu', id: 'menu', role: 'menu', tabIndex: -1, onclick: ev => ev.stopPropagation()},
    h('p', {class: 'menu-title'}, t('remind')),
    Remind.times().map(o => h('button', {
      type: 'button',
      role: 'menuitem',
      onclick: () => {
        closeMenu();
        if (state.reading) {
          actFromReader('remind', state.reading.e, o.until);
        }
        else {
          act('remind', links, o.until);
        }
      }
    }, h('span', {}, t(o.key)), h('span', {class: 'hint'}, later(o.until)))));
  // Tab, or a click into the message, leaves it: it closes, the focus stays where it went
  menu.addEventListener('focusout', ev => menu.id === 'menu' && !menu.contains(ev.relatedTarget) && closeMenu());
  document.body.append(menu);
  menuFrom = anchor;
  anchor.setAttribute('aria-expanded', 'true');
  // under the button and inside the window, above it when there is no room below. A larger
  // text size zooms the page: the button's place and the window come in zoomed pixels, the
  // menu's size and place are written in the page's own, so the zoom is taken off
  const z = parseFloat(document.documentElement.style.zoom) || 1;
  const r = anchor.getBoundingClientRect();
  const [right, top, bottom, width, height] = [r.right, r.top, r.bottom, innerWidth, innerHeight].map(v => v / z);
  const w = menu.offsetWidth;
  const ht = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(right - w, width - w - 8)) + 'px';
  menu.style.top = (bottom + ht + 8 > height ? Math.max(8, top - ht - 4) : bottom + 4) + 'px';
  menu.querySelector('button').focus();
};
document.addEventListener('click', () => closeMenu());
const remindBtn = links => {
  const el = btn('clock', t('remind') + ' (B)', ev => remindMenu(ev.currentTarget, links), 'remind');
  el.setAttribute('aria-haspopup', 'menu');
  el.setAttribute('aria-expanded', 'false');
  return el;
};

/* side panel: the deck stays open beside the page; Chrome opens it only from a click */
const openSide = () => chrome.sidePanel.open({windowId: state.windowId}).then(() => window.close(), () => toast(t('actionFailed'), true));

/* header */
const renderBar = objs => {
  const total = objs.reduce((p, o) => p + o.xml.fullcount, 0);
  const busy = objs.filter(o => o.xml.fullcount).length;
  $('sub').replaceChildren(!objs.length ? '' :
    total ? (busy === 1 ? t('summaryOne', total) : t('summaryMany', total, busy)) : h('span', {class: 'ok'}, icon('done'), t('caughtUp')));
  $('tools').replaceChildren(...[
    btn('refresh', t('checkMail'), ev => {
      refreshing = true;
      ev.currentTarget.classList.add('spin');
      chrome.runtime.sendMessage({method: 'update', forced: true});
      setTimeout(stopSpin, 15000);
    }, refreshing ? 'refresh spin' : 'refresh'),
    objs.some(o => !serviceOf(o)) && btn('search', t('search') + ' (/)', openSearch, state.search ? 'on' : ''),
    btn('compose', t('compose') + (objs.length > 1 ? ': ' + composeFrom(objs).xml.title : ''),
      () => openUrl(composeUrl(composeFrom(objs)))),
    btn('addUser', t('addAccount'), () => openUrl(ADD_ACCOUNT)),
    !SIDE && chrome.sidePanel && btn('side', t('sidePanel'), openSide),
    btn('tune', t('settings'), () => chrome.runtime.openOptionsPage())
  ].filter(Boolean));
};
const stopSpin = () => {
  refreshing = false;
  document.querySelector('.refresh')?.classList.remove('spin');
};

/* one chip per mailbox with mail; a click shows only that mailbox */
// the name before the @; where two mailboxes share it, the part after it tells them apart
const short = (o, all) => {
  const [name, domain = name] = o.xml.title.split('@');
  return all.some(x => x.xml.title !== o.xml.title && x.xml.title.split('@')[0] === name) ? domain : name;
};
const renderChips = objs => {
  const busy = objs.filter(o => o.xml.fullcount);
  if (!busy.some(o => o.xml.link === state.only)) {
    state.only = null;
  }
  const chip = (o, label, n) => h('button', {
    'class': 'chip' + ((o?.xml.link ?? null) === state.only ? ' on' : ''),
    'type': 'button',
    'aria-pressed': String((o?.xml.link ?? null) === state.only),
    'data-focus': 'chip:' + (o?.xml.link ?? ''),
    'style': o ? `--c:${o.color}` : '',
    'onclick': () => {
      state.only = o?.xml.link ?? null;
      render();
    }
  }, o && h('span', {class: 'dot'}), label, h('span', {class: 'count'}, n > 999 ? '999+' : n));
  $('chips').replaceChildren(...(busy.length < 2 || state.search ? [] : [
    chip(null, t('all'), busy.reduce((p, o) => p + o.xml.fullcount, 0)),
    ...busy.map(o => chip(o, short(o, busy) + (o.xml.label ? ` [${o.xml.label}]` : ''), o.xml.fullcount))
  ]));
};

/* search: every mailbox at once, or the one the chips chose */
const openSearch = () => {
  state.search = state.search || {q: '', busy: false, results: null};
  $('search').hidden = false;
  render();
  $('search-input').focus();
};
const closeSearch = () => {
  const inside = $('search').contains(document.activeElement);
  state.search = null;
  $('search').hidden = true;
  $('search-input').value = '';
  say('');
  render();
  // the field goes; the focus goes back to the button that opened it
  if (inside) {
    $('tools').querySelector('[data-focus="search"]')?.focus();
  }
};
// what a screen reader says of the search; the list itself changes without a word
const say = text => {
  $('status').textContent = text;
};
const runSearch = q => {
  q = q.trim();
  if (!q) {
    return;
  }
  // a mailbox watched through labels is one account all the same; only Gmail can be searched,
  // so a chip of another service searches every Gmail account
  const gmails = view().filter(o => !serviceOf(o));
  const chosen = gmails.filter(o => o.xml.link === state.only);
  const accounts = (chosen.length ? chosen : gmails).filter((o, i, l) => l.findIndex(x => x.xml.title === o.xml.title) === i);
  const s = state.search = {q, busy: true, results: null};
  render();
  say(t('searching'));
  Promise.all(accounts.map(o => searchIn(o, q).then(entries => ({o, entries: entries || [], failed: !entries}))))
    .then(results => {
      if (state.search !== s) {
        return;
      }
      s.busy = false;
      s.results = results;
      results.flatMap(r => r.entries).filter(e => e.starred).forEach(e => state.starred.add(thread(e.link)));
      render();
      const n = results.reduce((p, r) => p + r.entries.length, 0);
      say(results.every(r => r.failed) ? t('searchFailed') : n ? t('found', n) : t('searchNone'));
    });
};
const note = text => h('div', {class: 'empty'}, h('p', {}, text));
const searchList = () => {
  const s = state.search;
  if (s.busy) {
    return [note(t('searching'))];
  }
  if (!s.results) {
    return [];
  }
  if (s.results.every(r => r.failed)) {
    return [note(t('searchFailed'))];
  }
  // an account that did not answer keeps its line, saying so, with its way to Gmail's own search
  const shown = s.results.map(r => ({...r, entries: r.entries.filter(e => !state.hidden.has(e.link))}))
    .filter(r => r.failed || r.entries.length);
  return [
    ...shown.map(r => h('section', {'class': 'section', 'style': `--c:${r.o.color}`, 'data-scope': r.o.xml.title},
      h('header', {class: 'section-head', title: t('openInGmail'), onclick: () => openUrl(searchUrl(r.o, s.q))},
        mark(r.o.xml.title),
        h('span', {class: 'addr'}, r.o.xml.title),
        h('span', {class: 'none'}, r.failed ? t('searchFailed') : t('found', r.entries.length)),
        h('span', {class: 'grow'}),
        btn('open', t('openInGmail'), () => openUrl(searchUrl(r.o, s.q)))
      ),
      r.entries.length > 0 && h('div', {class: 'cards'}, r.entries.map(e => row(e, r.o)))
    )),
    shown.every(r => r.failed) && note(t('searchNone'))
  ].filter(Boolean);
};

/* list */
// a mail pointed at, or reached with the keys, is likely the next one opened: its
// print view comes meanwhile, so the reader shows it at once
let prefetchTimer;
const bodyOf = (e, o) => serviceOf(o) ? gmail.serviceBody(e.link, e.modified) : gmail.body(e.link, true, e.modified);
// Gmail's print view leaves a mail unread; another service may count a fetched mail as read,
// so its mail is fetched on the click only
const prefetch = (e, o) => {
  clearTimeout(prefetchTimer);
  if (!serviceOf(o)) {
    prefetchTimer = setTimeout(() => bodyOf(e, o).catch(() => {}), 120);
  }
};
const row = (e, o) => {
  state.rows.set(e.link, {e, o});
  const code = codeOf(e.title + ' ' + e.summary);
  return h('article', {
    'class': 'row' + (e.unread === false ? ' seen' : ''),
    'tabIndex': 0,
    'data-link': e.link,
    // a mail folding away after its action takes no second click
    'onclick': ev => state.hidden.has(e.link) ? null : ev.metaKey || ev.ctrlKey || !can(o, 'body') ? openEntry(e, o, ev) : read(e, o),
    'onauxclick': ev => ev.button === 1 && openEntry(e, o, ev),
    'onmouseenter': () => prefetch(e, o),
    'onmouseleave': () => clearTimeout(prefetchTimer),
    'onfocus': () => prefetch(e, o)
  },
  avatar(e, o),
  h('span', {class: 'from'}, e.author_name),
  h('time', {class: 'when', dateTime: e.modified, title: fullDate(e.modified)}, when(e.modified)),
  h('span', {class: 'subject'},
    state.starred.has(thread(e.link)) && h('span', {class: 'starred', title: t('starred')}, icon('star')),
    // before the subject: a long one ends in an ellipsis, the code must not
    code && codePill(code),
    e.title || t('noSubject')),
  h('span', {class: 'snippet'}, e.summary),
  h('div', {class: 'acts'},
    ['rd', 'rc_^i', 'tr'].filter(cmd => cmd !== 'rc_^i' || can(o, 'archive'))
      .map(cmd => btn(ACTIONS[cmd].icon, ACTIONS[cmd].title, () => act(cmd, [e.link]), ACTIONS[cmd].danger ? 'danger' : '')),
    remindBtn([e.link]),
    btn('open', openIn(o) + ' (O)', ev => openEntry(e, o, ev))
  ));
};
// every signed-in mailbox gets its line, with its unread mail under it
const section = o => {
  // the mail past the feed's 20, from the search; what was acted on here leaves the count as well
  const all = state.extra.get(o.xml.link) || [];
  const extra = all.filter(e => !state.hidden.has(e.link));
  const n = Math.max(0, o.xml.fullcount - (all.length - extra.length));
  const open = state.expanded.has(o.xml.link);
  const entries = open ? [...o.xml.entries, ...extra] : o.xml.entries;
  const links = entries.map(e => e.link);
  const rest = n - entries.length;
  return h('section', {'class': 'section' + (n ? '' : ' idle'), 'style': `--c:${o.color}`, 'data-key': accountName(o)},
    h('header', {class: 'section-head', title: openInbox(o), draggable: true, onclick: () => openUrl(o.xml.link)},
      h('span', {class: 'grip', title: t('drag') + ' (Alt+↑/↓)'}, icon('grip')),
      mark(o.xml.title),
      h('span', {class: 'addr'}, accountName(o)),
      n ? h('span', {class: 'n'}, n > 999 ? '999+' : n) : h('span', {class: 'none'}, t('noNewMail')),
      copyBtn(o.xml.title),
      h('span', {class: 'grow'}),
      entries.length > 0 && btn('readAll', t('markAllRead'), () => act('rd', links)),
      entries.length > 0 && can(o, 'archive') && btn('archive', t('archiveAll'), () => act('rc_^i', links)),
      !serviceOf(o) && btn('meet', t('newMeeting'), () => openUrl(meetUrl(o)), 'meet'),
      btn('open', openInbox(o), () => openUrl(o.xml.link))
    ),
    entries.length > 0 && h('div', {class: 'cards'}, entries.map(e => row(e, o)),
      !open && extra.length > 0 ? h('button', {class: 'more', type: 'button', onclick: () => {
        state.expanded.add(o.xml.link);
        // the button goes; the first mail it brought takes the focus
        state.focus = extra[0].link;
        render();
      }}, t('showMore', Math.min(extra.length, rest))) :
        rest > 0 && h('button', {class: 'more', type: 'button', onclick: () => openUrl(o.xml.link)},
          serviceOf(o) ? t('moreIn', rest, serviceOf(o).name) : t('moreInGmail', rest)))
  );
};
const signIn = () => h('div', {class: 'empty'},
  h('span', {class: 'badge mail'}, icon('mail')),
  h('h3', {}, t('signIn')),
  h('p', {}, t('signInText')),
  h('button', {class: 'text-btn', type: 'button', onclick: () => openUrl(ADD_ACCOUNT)}, t('signIn')),
  h('button', {class: 'text-btn quiet', type: 'button', onclick: openServices}, t('otherServices'))
);
const openServices = () => {
  chrome.tabs.create({url: chrome.runtime.getURL('/data/settings/index.html#services')});
  if (!SIDE) {
    window.close();
  }
};
// every mailbox is empty: the bar says so, the list keeps a way into each of them
const caughtUp = objs => h('div', {class: 'caught-up'},
  h('div', {class: 'accounts'}, objs.map(o => h('div', {
    'class': 'acc',
    'style': `--c:${o.color}`,
    'data-key': accountName(o),
    'draggable': true,
    'tabIndex': 0,
    'onclick': () => openUrl(o.xml.link)
  },
    h('span', {class: 'grip', title: t('drag') + ' (Alt+↑/↓)'}, icon('grip')),
    mark(o.xml.title),
    h('span', {class: 'addr'}, accountName(o)),
    copyBtn(o.xml.title),
    !serviceOf(o) && btn('meet', t('newMeeting'), () => openUrl(meetUrl(o)), 'meet'),
    h('button', {class: 'go', type: 'button'}, t('open'), icon('open'))
  )))
);
// addresses seen here before that are not signed in now: a click signs one back in
const forget = email => chrome.storage.local.get({accounts: {}}, prefs => {
  prefs.accounts[email] = {...prefs.accounts[email], signedOutHidden: true};
  chrome.storage.local.set({accounts: prefs.accounts});
});
const signedOut = () => {
  const now = new Set(state.objs.map(o => o.xml.title));
  const list = Object.entries(state.accounts)
    .filter(([email, meta]) => email.includes('@') && !now.has(email) && meta?.signedOutHidden !== true)
    .map(([email]) => email);
  return list.length === 0 ? null : h('section', {class: 'section away'},
    h('header', {class: 'section-head plain'}, h('span', {class: 'addr'}, t('signedOut'))),
    h('div', {class: 'accounts'}, list.map(email => h('div', {class: 'acc', onclick: () => openUrl(signInUrl(email))},
      mark(email),
      h('span', {class: 'addr'}, email),
      h('button', {class: 'go', type: 'button'}, t('signInAgain'), icon('open')),
      btn('close', t('forget'), () => forget(email), 'forget')
    )))
  );
};
const renderList = objs => {
  const list = $('list');
  const top = list.scrollTop;
  // an action or its Undo names the line that takes the focus, and brings it into view; any
  // other drawing keeps the focused line where it is, scrolled to or not
  const wanted = state.focus;
  const focused = wanted || document.activeElement?.dataset?.link;
  state.focus = null;
  state.rows.clear();

  const shown = state.only ? objs.filter(o => o.xml.link === state.only) : objs;
  list.replaceChildren(...(state.search ? searchList() : [
    ...(!objs.length ? [signIn()] : objs.some(o => o.xml.fullcount) ? shown.map(section) : [caughtUp(objs)]),
    !state.only && signedOut()
  ].filter(Boolean)));
  list.scrollTop = top;
  const el = focused === FIRST ? list.querySelector('.row, .acc') : focused && rowOf(focused);
  el?.focus({preventScroll: true});
  if (wanted) {
    el?.scrollIntoView({block: 'nearest'});
  }
};

/* the mailboxes change places by dragging their line */
{
  const list = $('list');
  const clear = () => list.querySelectorAll('.drop-before, .drop-after, .dragging')
    .forEach(el => el.classList.remove('drop-before', 'drop-after', 'dragging'));
  const over = ev => {
    const el = ev.target.closest?.('[data-key]');
    return el && state.drag && el.dataset.key !== state.drag ? el : null;
  };
  list.addEventListener('dragstart', ev => {
    const el = ev.target.closest?.('[data-key]');
    if (!el) {
      return;
    }
    state.drag = el.dataset.key;
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', state.drag);
    el.classList.add('dragging');
  });
  list.addEventListener('dragover', ev => {
    const el = over(ev);
    if (!el) {
      return;
    }
    ev.preventDefault();
    const r = el.getBoundingClientRect();
    const before = ev.clientY < r.top + Math.min(r.height / 2, 24);
    if (!el.classList.contains(before ? 'drop-before' : 'drop-after')) {
      list.querySelectorAll('.drop-before, .drop-after').forEach(e => e.classList.remove('drop-before', 'drop-after'));
      el.classList.add(before ? 'drop-before' : 'drop-after');
    }
  });
  list.addEventListener('drop', ev => {
    const el = over(ev);
    if (!el) {
      return;
    }
    ev.preventDefault();
    const keys = view().map(accountName).filter(k => k !== state.drag);
    keys.splice(keys.indexOf(el.dataset.key) + (el.classList.contains('drop-after') ? 1 : 0), 0, state.drag);
    state.order = keys;
    chrome.storage.local.set({accountOrder: keys});
    clear();
    render();
  });
  list.addEventListener('dragend', () => {
    state.drag = null;
    clear();
  });
}

// where the focus is, said so that it outlives the list drawn again: a button by its name,
// inside its mail, its mailbox or its bar
const focusPath = () => {
  const el = document.activeElement;
  const name = el?.dataset?.focus;
  if (!name) {
    return null;
  }
  const what = `[data-focus="${CSS.escape(name)}"]`;
  const row = el.closest('.row[data-link]');
  const box = el.closest('[data-key], [data-scope]');
  const bar = el.closest('#tools, #chips, #list');
  return row ? `.row[data-link="${CSS.escape(row.dataset.link)}"] ${what}` :
    box ? `[${box.dataset.key ? 'data-key' : 'data-scope'}="${CSS.escape(box.dataset.key || box.dataset.scope)}"] ${what}` :
      bar ? `#${bar.id} ${what}` : null;
};
// the accounts as the list shows them, to tell a change from none: a mailbox's snapshot
// clock (its feed's modified) moves on without anything new to show; its mails' do not
const sig = objs => JSON.stringify(objs, function (k, v) {
  return k === 'modified' && Array.isArray(this.entries) ? undefined : v;
});
// the accounts last drawn; the same ones again need no drawing
let drawn = '';
const render = () => {
  const path = focusPath();
  const objs = view();
  drawn = sig(state.objs);
  // the chips drop a choice whose mailbox has no mail left; the bar's compose follows the choice
  renderChips(objs);
  renderBar(objs);
  renderList(objs);
  // a button drawn again gets the focus back, unless a line took it
  if (path && (!document.activeElement || document.activeElement === document.body)) {
    document.querySelector(path)?.focus({preventScroll: true});
  }
};
const update = objs => {
  state.objs = objs || [];
  // the search's mail counts as listed too, the feed never lists it
  const listed = new Set([
    ...state.objs.flatMap(o => o.xml.entries.map(e => e.link)),
    ...[...state.extra.values()].flat().map(e => e.link),
    ...(state.search?.results || []).flatMap(r => r.entries.map(e => e.link))
  ]);
  for (const link of state.hidden) {
    if (!listed.has(link)) {
      state.hidden.delete(link);
    }
  }
  // A check that found nothing new, every two minutes, leaves the list as it is: the focus,
  // the pointer's line and its pictures stay; only the times move on. Mail folding away
  // after its action draws the list itself once the fold is done.
  if (sig(state.objs) === drawn) {
    for (const el of $('list').querySelectorAll('time.when')) {
      el.textContent = when(el.dateTime);
    }
  }
  else if (performance.now() >= foldUntil) {
    render();
  }
  loadExtra();
};

/* reader */
const frame = $('body');
const frameReady = new Promise(resolve => {
  const ready = () => {
    const doc = frame.contentDocument;
    doc.head.append(h('style', {}, `
      body { font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; padding: 16px 20px 28px; color: #1b1f24; }
      body, td { font-size: 14px; }
      body.summary { color: #5f6772; }
      html.dark, html.dark body { background: #e1e1df; }
      .note { margin-top: 16px; color: #5f6772; }
      .pictures { margin: 0 0 14px; }
      .pictures button { padding: 6px 12px; border: 1px solid #d6d9de; border-radius: 14px; background: #fff; color: #1b1f24; font: inherit; font-size: 13px; cursor: pointer; }
      .pictures button:hover { background: #f2f3f5; }
    `));
    resolve(doc);
  };
  if (frame.contentDocument?.readyState === 'complete' && frame.contentDocument.querySelector('base')) {
    ready();
  }
  else {
    frame.addEventListener('load', ready, {once: true});
  }
});
frameReady.then(doc => {
  const paint = () => doc.documentElement.classList.toggle('dark', dark.matches);
  paint();
  dark.addEventListener('change', paint);
});
// A message laid out wider than the panel, a newsletter of 600-700px say, is
// scaled down to fit, as Gmail does on a phone. Its width settles only once
// its images load, an older message opens or the side panel is resized.
const fit = doc => {
  for (const el of doc.querySelectorAll('.root')) {
    el.style.zoom = '';
    const room = el.parentElement.clientWidth;
    if (!room) {
      continue;
    }
    // a wide child may hide behind an overflow: hidden of the print view
    const left = el.getBoundingClientRect().left;
    let right = el.getBoundingClientRect().right;
    for (const c of el.querySelectorAll('table, img, div, pre')) {
      right = Math.max(right, c.getBoundingClientRect().right);
    }
    if (right - left > room + 1) {
      el.style.zoom = Math.max(0.4, room / (right - left)).toFixed(3);
    }
  }
};
frameReady.then(doc => {
  let raf;
  const refit = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => fit(doc));
  };
  doc.addEventListener('load', refit, true);
  doc.addEventListener('toggle', refit, true);
  doc.defaultView.addEventListener('resize', refit);
});

// the reader lies over the list: what is under it can be neither focused nor read out
const shade = on => {
  for (const el of [document.querySelector('.main > .bar'), $('search'), $('chips'), $('list')]) {
    el.inert = on;
  }
};
// the mail next to an open one in the list the reader came from, past the mail acted on here
// and the mail the panel cannot read
const besideOpen = (link, step) => {
  const rows = state.trail || state.rows;
  const keys = [...rows.keys()];
  const at = keys.indexOf(link);
  for (let i = at + step; at !== -1 && i >= 0 && i < keys.length; i += step) {
    const r = rows.get(keys[i]);
    if (!state.hidden.has(keys[i]) && can(r.o, 'body')) {
      return r;
    }
  }
  return null;
};
// J and K, and the reader's arrows
const stepReader = step => {
  const r = state.reading && besideOpen(state.reading.e.link, step);
  if (r) {
    read(r.e, r.o);
  }
};
// an action from the reader: back to the list, or on to the next mail when the settings say so
const actFromReader = (cmd, e, until) => {
  const next = state.autoAdvance ? besideOpen(e.link, 1) || besideOpen(e.link, -1) : null;
  back();
  act(cmd, [e.link], until);
  if (next) {
    read(next.e, next.o);
  }
};
const read = async (e, o) => {
  if (!state.reading) {
    state.trail = new Map(state.rows);
  }
  // next: the line back() focuses should this mail's own leave the list meanwhile (read on open)
  state.reading = {e, o, next: neighbour([e.link])?.dataset.link, code: codeOf(e.title + ' ' + e.summary)};
  closeMenu();
  const trail = [...state.trail.keys()].filter(k => k === e.link || !state.hidden.has(k));
  $('reader-bar').replaceChildren(
    btn('back', t('back') + ' (Esc)', back),
    h('span', {class: 'pos'}, t('position', trail.indexOf(e.link) + 1, trail.length)),
    btn('up', t('prevMessage') + ' (K)', () => stepReader(-1), 'prev'),
    btn('down', t('nextMessage') + ' (J)', () => stepReader(1), 'next'),
    ...Object.entries(ACTIONS).filter(([cmd]) => allowed(cmd, o)).map(([cmd, a]) => btn(a.icon, a.title,
      () => actFromReader(cmd, e), a.danger ? 'danger' : '')),
    remindBtn([e.link]),
    h('span', {class: 'sep'}),
    !serviceOf(o) && btn('star', t('star') + ' (S)', () => star(e), 'star'),
    btn('reply', t('reply'), () => openUrl(replyUrl(e, o))),
    btn('open', openIn(o) + ' (O)', ev => openEntry(e, o, ev))
  );
  $('reader-bar').querySelector('.prev').disabled = !besideOpen(e.link, -1);
  $('reader-bar').querySelector('.next').disabled = !besideOpen(e.link, 1);
  paintStar();
  // the key hints say only what this mailbox can do
  $('reader').classList.toggle('no-star', Boolean(serviceOf(o)));
  $('reader').classList.toggle('no-archive', !can(o, 'archive'));
  $('reader-account').style.setProperty('--c', o.color);
  $('reader-account').lastChild.textContent = accountName(o);
  $('reader-subject').textContent = e.title || t('noSubject');
  if (state.reading.code) {
    $('reader-subject').append(' ', codePill(state.reading.code));
  }
  $('reader-avatar').replaceChildren(avatar(e, o));
  $('reader-name').textContent = e.author_name;
  $('reader-addr').replaceChildren(h('span', {}, e.author_email), copyBtn(e.author_email));
  $('reader-date').textContent = fullDate(e.modified);
  $('app').classList.add('reading');
  shade(true);
  // the keys and a screen reader follow the reader
  $('reader').focus({preventScroll: true});

  const doc = await frameReady;
  doc.querySelector('base').href = e.link;
  doc.body.className = 'summary';
  doc.body.textContent = e.summary;
  $('reader').classList.add('loading');
  let shown = false;
  try {
    const node = await bodyOf(e, o);
    if (state.reading?.e !== e) {
      return;
    }
    if (!node) {
      throw Error('empty');
    }
    doc.body.className = '';
    doc.body.replaceChildren(node);
    // a service's remote pictures, sounds and videos load only when asked for
    if (gmail.render.held(doc.body)) {
      const bar = h('p', {class: 'pictures'}, h('button', {type: 'button', onclick: () => {
        bar.remove();
        gmail.render.show(doc.body);
      }}, t('showPictures')));
      doc.body.prepend(bar);
    }
    fit(doc);
    shown = true;
    // a code the snippet did not reach, from the newest message only: a thread of codes from one
    // sender would offer an older one
    if (!state.reading.code) {
      const last = [...doc.querySelectorAll('details.msg')].at(-1) || doc.body;
      state.reading.code = codeOf(e.title + ' ' + last.innerText.slice(0, 3000));
      if (state.reading.code) {
        $('reader-subject').append(' ', codePill(state.reading.code));
      }
    }
    // the mail J opens comes meanwhile
    const ahead = besideOpen(e.link, 1);
    if (ahead) {
      prefetch(ahead.e, ahead.o);
    }
  }
  catch (err) {
    if (state.reading?.e === e) {
      doc.body.append(h('p', {class: 'note'}, serviceOf(o) ? t('bodyFailedIn', serviceOf(o).name) : t('bodyFailed')));
    }
  }
  finally {
    $('reader').classList.remove('loading');
  }
  // the settings may ask for a mail read here to count as read, once it did show: one that
  // did not load stays unread. Gmail's print view has set the cookie by now
  if (shown && state.readOnOpen && e.unread !== false && !state.hidden.has(e.link)) {
    state.hidden.add(e.link);
    render();
    send({cmd: 'rd', links: [e.link]});
  }
};
const back = () => {
  const r = state.reading;
  state.reading = null;
  state.trail = null;
  shade(false);
  $('app').classList.remove('reading');
  if (r) {
    (rowOf(r.e.link) || (r.next && rowOf(r.next)) || $('list').querySelector('.row, .acc'))?.focus({preventScroll: true});
  }
};

/* keyboard: layout independent, so it works with the Russian layout too */
// Alt+↑/↓ moves the mailbox of the focused line, the keyboard's way to drag it
const moveMailbox = (key, step) => {
  const keys = view().map(accountName);
  const i = keys.indexOf(key);
  const j = i + step;
  if (i === -1 || j < 0 || j >= keys.length) {
    return;
  }
  [keys[i], keys[j]] = [keys[j], keys[i]];
  state.order = keys;
  chrome.storage.local.set({accountOrder: keys});
  const focused = document.activeElement;
  render();
  // the same line keeps the focus after the list is drawn again
  (focused?.dataset.link ? $('list').querySelector(`.row[data-link="${CSS.escape(focused.dataset.link)}"]`) :
    $('list').querySelector(`.acc[data-key="${CSS.escape(key)}"]`))?.focus();
};
const onKey = ev => {
  if (ev.altKey && !ev.metaKey && !ev.ctrlKey && (ev.code === 'ArrowUp' || ev.code === 'ArrowDown') && !state.reading) {
    const key = document.activeElement?.closest?.('[data-key]')?.dataset.key;
    if (key) {
      ev.preventDefault();
      moveMailbox(key, ev.code === 'ArrowUp' ? -1 : 1);
    }
    return;
  }
  if (ev.metaKey || ev.ctrlKey || ev.altKey) {
    return;
  }
  // a mailbox line of the caught-up list opens with Enter like a click
  if (ev.code === 'Enter' && document.activeElement?.classList.contains('acc')) {
    document.activeElement.click();
    ev.preventDefault();
    return;
  }
  // the search field takes its keys; Esc there is the field's own
  if (ev.target.closest?.('input, textarea')) {
    return;
  }
  const menu = $('menu');
  if (menu) {
    const items = [...menu.querySelectorAll('button')];
    const i = items.indexOf(document.activeElement);
    if (ev.code === 'Escape') {
      closeMenu(true);
    }
    else if (ev.code === 'ArrowDown' || ev.code === 'KeyJ') {
      items[Math.min(items.length - 1, i + 1)].focus();
    }
    else if (ev.code === 'ArrowUp' || ev.code === 'KeyK') {
      items[Math.max(0, i - 1)].focus();
    }
    else {
      return;
    }
    ev.preventDefault();
    return;
  }
  const rowEl = document.activeElement?.closest?.('.row');
  const target = state.reading || (rowEl && state.rows.get(rowEl.dataset.link));
  const move = step => {
    const rows = [...document.querySelectorAll('.row')];
    const next = rows[Math.min(rows.length - 1, Math.max(0, rows.indexOf(rowEl) + step))];
    next?.focus();
    next?.scrollIntoView({block: 'nearest'});
  };
  const run = cmd => {
    if (target && allowed(cmd, target.o)) {
      if (state.reading) {
        actFromReader(cmd, target.e);
      }
      else {
        act(cmd, [target.e.link]);
      }
    }
  };

  if (ev.code === 'Escape' && state.reading) {
    back();
  }
  else if (ev.code === 'Escape' && state.search) {
    closeSearch();
  }
  else if (ev.code === 'KeyZ' && state.pending) {
    undo();
  }
  else if (ev.code === 'KeyS' && state.reading) {
    $('reader-bar').querySelector('.star')?.click();
  }
  else if (ev.code === 'KeyB' && target) {
    const anchor = (state.reading ? $('reader-bar') : rowEl).querySelector('.remind');
    remindMenu(anchor, [target.e.link]);
  }
  else if (ev.code === 'Slash' && !state.reading) {
    openSearch();
  }
  // the one-time code of the open mail or the focused line
  else if (ev.code === 'KeyC' && target) {
    const code = state.reading ? state.reading.code : codeOf(target.e.title + ' ' + target.e.summary);
    if (!code) {
      return;
    }
    copyCode(code, (state.reading ? $('reader-subject') : rowEl).querySelector('.code'));
  }
  // in the reader J and K go to the next and the previous mail; the arrows scroll the message
  else if (state.reading && (ev.code === 'KeyJ' || ev.code === 'KeyK')) {
    stepReader(ev.code === 'KeyJ' ? 1 : -1);
  }
  else if (state.reading && ['ArrowDown', 'ArrowUp', 'Enter'].includes(ev.code)) {
    return;
  }
  else if (ev.code === 'ArrowDown' || ev.code === 'KeyJ') {
    move(1);
  }
  else if (ev.code === 'ArrowUp' || ev.code === 'KeyK') {
    move(-1);
  }
  else if (ev.code === 'Enter' && rowEl && rowEl === document.activeElement) {
    // as a click: a mail the panel cannot read opens on its site
    if (can(target.o, 'body')) {
      read(target.e, target.o);
    }
    else {
      openEntry(target.e, target.o, ev);
    }
  }
  else if (ev.code === 'KeyO' && target) {
    openEntry(target.e, target.o, ev);
  }
  else if (ev.code === 'KeyE') {
    run('rc_^i');
  }
  else if (ev.code === 'KeyR') {
    run('rd');
  }
  else if (ev.code === 'Delete' || ev.code === 'Backspace' || (ev.code === 'Digit3' && ev.shiftKey)) {
    run('tr');
  }
  else if (ev.code === 'Digit1' && ev.shiftKey) {
    run('sp');
  }
  else {
    return;
  }
  ev.preventDefault();
};
document.addEventListener('keydown', onKey);
// a click into the message moves the focus into its frame; the keys have to work there too
frameReady.then(doc => doc.addEventListener('keydown', onKey));

/* search field: built once, so typing survives every render */
{
  const input = $('search-input');
  input.placeholder = t('searchPlaceholder');
  $('search').prepend(icon('search'));
  $('search').append(btn('close', t('closeSearch') + ' (Esc)', closeSearch));
  $('search').addEventListener('submit', ev => {
    ev.preventDefault();
    runSearch(input.value);
  });
  input.addEventListener('keydown', ev => {
    if (ev.code === 'Escape') {
      ev.preventDefault();
      closeSearch();
    }
  });
}

/* background */
chrome.runtime.onMessage.addListener(request => {
  if (request.method === 'update' || request.method === 'update-reset' || request.method === 'update-date') {
    stopSpin();
    update(request.data);
  }
  else if (request.method === 'close-popup' && !SIDE) {
    window.close();
  }
});

document.documentElement.lang = LANG;
document.documentElement.dir = chrome.i18n.getMessage('@@bidi_dir') || 'ltr';
document.documentElement.classList.toggle('side', SIDE);
for (const el of document.querySelectorAll('[data-i18n]')) {
  el.textContent = t(el.dataset.i18n);
}
for (const el of document.querySelectorAll('[data-i18n-label]')) {
  el.setAttribute(el.tagName === 'IFRAME' ? 'title' : 'aria-label', t(el.dataset.i18nLabel));
}

/* settings the panel follows: text size, read on open, the addresses seen so far, their order */
const prefsChanged = prefs => {
  if ('panelScale' in prefs) {
    const scale = Number(prefs.panelScale) || 1;
    document.documentElement.style.zoom = scale === 1 ? '' : scale;
    document.documentElement.style.setProperty('--zoom', scale);
  }
  if ('readOnOpen' in prefs) {
    state.readOnOpen = prefs.readOnOpen === true;
  }
  if ('accounts' in prefs) {
    state.accounts = prefs.accounts || {};
  }
  if ('accountOrder' in prefs) {
    state.order = prefs.accountOrder || [];
  }
  if ('senderLogos' in prefs) {
    state.senderLogos = prefs.senderLogos !== false;
  }
  if ('avatars' in prefs) {
    state.avatars = prefs.avatars || {};
  }
  if ('autoAdvance' in prefs) {
    state.autoAdvance = prefs.autoAdvance === true;
  }
  if ('badge.count' in prefs) {
    state.badgeNew = prefs['badge.count'] === 'new';
  }
};
// With the toolbar count at "mail since the panel was last opened", opening the panel starts it
// again, and so does a side panel coming back into view. Never a list update: the background
// sends one for the very redraw this asks for.
const markSeen = () => {
  if (state.badgeNew && document.visibilityState === 'visible') {
    chrome.storage.local.set({'badge.seen': Date.now()});
  }
};
document.addEventListener('visibilitychange', markSeen);
chrome.storage.onChanged.addListener((ps, area) => {
  const changed = Object.fromEntries(['panelScale', 'readOnOpen', 'accounts', 'accountOrder', 'senderLogos', 'avatars', 'autoAdvance', 'badge.count']
    .filter(k => area === 'local' && ps[k]).map(k => [k, ps[k].newValue]));
  if (Object.keys(changed).length) {
    prefsChanged(changed);
    render();
  }
});
chrome.windows?.getCurrent().then(w => state.windowId = w.id);

Promise.all([
  chrome.storage.local.get({panelScale: 1, readOnOpen: false, accounts: {}, accountOrder: [], senderLogos: true, avatars: {},
    autoAdvance: false, 'badge.count': 'all', [Remind.KEY]: []}),
  chrome.storage.session.get({'cached-objects': [], [Resolved.KEY]: [], logos: {}})
]).then(([local, session]) => {
  prefsChanged(local);
  markSeen();
  Object.entries(session.logos).forEach(([domain, has]) => logos.set(domain, has));
  // the background hides the mail waiting for its reminder at the next check; until then this does
  update(Resolved.apply(Resolved.apply(session['cached-objects'], session[Resolved.KEY]), Remind.waiting(local[Remind.KEY])));
});
