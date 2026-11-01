'use strict';

// Every setting this page shows, with the background's defaults
const DEFAULTS = {
  'period': 120,
  'initialPeriod': 3,
  'network.watch': true,
  'idle.watch': true,
  'alphabetic': false,
  'notification': true,
  'notificationTime': 10,
  'notification.state.active': true,
  'notification.state.idle': true,
  'notification.state.locked': true,
  'notification.buttons.markasread': true,
  'notification.buttons.archive': true,
  'notification.buttons.trash': false,
  'combined': false,
  'threatAsNew': 10,
  'notificationFormat': chrome.i18n.getMessage('notification'),
  'notificationTruncate': 70,
  'silentTime': 10,
  'alert': true,
  'soundVolume': 80,
  'sound.state.active': true,
  'sound.state.idle': true,
  'sound.state.locked': true,
  'badge': true,
  'backgroundColor': '#e5484d',
  'minimal': true,
  'oldFashion': 0,
  'smartOpen': true,
  'currentTab': false,
  'newWindow': false,
  'ignoreOpens': false,
  'searchMode': true,
  'background': false,
  'relatedToCurrent': false,
  'onGmailNotification': true,
  'doReadOnArchive': true,
  'quiet.hours': false,
  'quiet.from': '22:00',
  'quiet.to': '08:00',
  'quiet.weekend': false,
  'notify.never': '',
  'notify.only': '',
  'panelScale': 1,
  'readOnOpen': false,
  'senderLogos': true,
  // the other mail services turned on (core/services/)
  'services': [],
  'sync.settings': false
};
const SERVICES = Object.values(self.MailServices || {});
// the default sound and five special ones, each a type (0-3 built in, 4 own file), a file and a mime
const MEDIA = ['default', 'custom0', 'custom1', 'custom2', 'custom3', 'custom4'].map(n => 'notification.sound.media.' + n);
for (const m of MEDIA) {
  DEFAULTS[m + '.type'] = 0;
}
for (const m of MEDIA.slice(1)) {
  DEFAULTS[m + '.selector'] = 0;
  DEFAULTS[m + '.filter'] = '';
}
for (let i = 0; i < 10; i += 1) {
  DEFAULTS['feeds_' + i] = '';
}
const SOUNDS = ['soundChime', 'soundBell', 'soundDing', 'soundClassic'];
const SWATCHES = ['#e5484d', '#4352e3', '#169b62', '#d9822b', '#8b55d9', '#4f5b6b'];

const store = chrome.storage.local;
// the page's strings live in _locales as opt_*; English stays in the HTML as the fallback
const t = (key, ...subs) => chrome.i18n.getMessage('opt_' + key, subs.map(String)) || key;
const $ = id => document.getElementById(id);
const h = (tag, props, ...kids) => {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...kids.filter(k => k !== null && k !== undefined && k !== false));
  return el;
};
let prefs = {};

/* saving */
let toastTimer;
const toast = text => {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
};
const save = values => {
  Object.assign(prefs, values);
  return store.set(values).then(() => {
    toast(t('saved'));
    if (prefs['sync.settings']) {
      pushSync();
    }
  }, e => toast(e.message));
};
// a page that reloads itself says why once it is back
const reloadWith = text => {
  try {
    sessionStorage.setItem('toast', text);
  }
  catch (e) {}
  location.reload();
};

// a row that depends on a switch fades out while the switch is off
const syncNeeds = () => {
  for (const row of document.querySelectorAll('[data-needs]')) {
    const on = prefs[row.dataset.needs];
    row.classList.toggle('off', !on);
    row.querySelectorAll('input, select, button, textarea').forEach(el => el.disabled = !on);
  }
};

/* plain fields: data-key names the stored setting */
const paintFields = () => {
  for (const el of document.querySelectorAll('[data-key]')) {
    const value = prefs[el.dataset.key];
    if (el.type === 'checkbox') {
      el.checked = el.hasAttribute('data-invert') ? !value : value;
    }
    else {
      if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === String(value))) {
        el.add(new Option(t('custom', value), value));
      }
      el.value = value;
    }
  }
  const mode = prefs.currentTab ? 'current' : prefs.newWindow ? 'window' : 'tab';
  document.querySelector(`input[name="open"][value="${mode}"]`).checked = true;
};
document.addEventListener('change', ({target}) => {
  const key = target.dataset.key;
  if (key) {
    let value = target.value;
    if (target.type === 'checkbox') {
      value = target.hasAttribute('data-invert') ? !target.checked : target.checked;
    }
    else if (target.dataset.type === 'number') {
      value = Number(value);
    }
    save({[key]: value});
    syncNeeds();
    if (key === 'sync.settings' && !value) {
      dropSync();
    }
  }
  else if (target.name === 'open') {
    save({currentTab: target.value === 'current', newWindow: target.value === 'window'});
  }
  else if (target.name === 'scope') {
    document.body.dataset.scope = target.value;
    try {
      localStorage.setItem('scope', target.value);
    }
    catch (e) {}
  }
});

/* badge colour: a few presets and any other colour */
const paintSwatches = () => {
  const color = prefs.backgroundColor;
  const pick = h('input', {type: 'color', className: 'pick', title: t('anyColour'), value: SWATCHES.includes(color) ? '#e5484d' : color});
  pick.classList.toggle('on', !SWATCHES.includes(color));
  pick.setAttribute('aria-label', t('anyColour'));
  pick.onchange = () => save({backgroundColor: pick.value}).then(paintSwatches);
  $('swatches').replaceChildren(...SWATCHES.map(c => {
    const input = h('input', {type: 'radio', name: 'swatch', value: c, checked: c === color, title: c});
    input.style.setProperty('--c', c);
    input.setAttribute('aria-label', c);
    input.onchange = () => save({backgroundColor: c}).then(paintSwatches);
    return input;
  }), pick);
};

/* sounds */
const pickFile = () => new Promise((resolve, reject) => {
  const input = $('file');
  input.value = '';
  input.oncancel = () => reject(Error('cancelled'));
  input.onchange = () => {
    const file = input.files[0];
    if (!file || !(file.type.startsWith('audio/') || file.type.startsWith('video/'))) {
      toast(t('pickAudio'));
      return reject(Error('not audio'));
    }
    const reader = new FileReader();
    reader.onload = () => resolve({data: reader.result, type: file.type});
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  };
  input.click();
});
const soundPicker = media => {
  const select = h('select', {}, ...SOUNDS.map((name, i) => h('option', {value: i, textContent: t(name)})),
    h('option', {value: 4, textContent: t('ownFile')}));
  select.setAttribute('aria-label', t('sound'));
  select.value = prefs[media + '.type'];
  select.onchange = () => {
    if (select.value !== '4') {
      return save({[media + '.type']: Number(select.value)});
    }
    pickFile().then(file => save({[media + '.file']: file.data, [media + '.mime']: file.type, [media + '.type']: 4}))
      .catch(() => select.value = prefs[media + '.type']);
  };
  return select;
};

// special sounds: up to five "when this contains that, play this" rules
const shownRules = new Set();
const paintRules = () => {
  MEDIA.slice(1).forEach((m, i) => prefs[m + '.filter'] && shownRules.add(i));
  $('rules').replaceChildren(...[...shownRules].sort().map(i => {
    const m = MEDIA[i + 1];
    const field = h('select', {}, ...['ruleSender', 'ruleSubject', 'ruleText'].map((name, v) => h('option', {value: v, textContent: t(name)})));
    field.value = prefs[m + '.selector'];
    field.onchange = () => save({[m + '.selector']: Number(field.value)});
    const word = h('input', {type: 'text', value: prefs[m + '.filter'], placeholder: t('rulePlaceholder'), spellcheck: false});
    word.onchange = () => save({[m + '.filter']: word.value.trim()});
    const remove = h('button', {type: 'button', className: 'ghost round', textContent: '×', title: t('ruleRemove')});
    remove.onclick = () => {
      shownRules.delete(i);
      save({[m + '.filter']: '', [m + '.selector']: 0, [m + '.type']: 0}).then(paintRules);
    };
    return h('div', {className: 'rule'}, field, word, soundPicker(m), remove);
  }));
  $('add-rule').hidden = shownRules.size >= 5;
  syncNeeds();
};
$('add-rule').onclick = () => {
  const free = [0, 1, 2, 3, 4].find(i => !shownRules.has(i));
  shownRules.add(free);
  paintRules();
  $('rules').lastChild.querySelector('input').focus();
};

/* inboxes */
const cleanLabels = value => value.split(',')
  .map(tag => tag.trim().replace(/^"|"$/g, '').replace(/[\s/]+/g, '-').toLowerCase())
  .filter((tag, i, all) => tag && all.indexOf(tag) === i)
  .join(', ');
// the Primary tab has a feed of its own, watched like a label in place of the inbox
const PRIMARY = '^smartlabel_personal';
const hasPrimary = value => value.split(',').map(s => s.trim()).includes(PRIMARY);
const withPrimary = (value, on) => {
  const list = value.split(',').map(s => s.trim()).filter(Boolean);
  if (on) {
    return list.includes(PRIMARY) ? list : list.includes('inbox') ? list.map(l => l === 'inbox' ? PRIMARY : l) : [PRIMARY, ...list];
  }
  const rest = list.filter(l => l !== PRIMARY && l !== 'inbox');
  return rest.length ? ['inbox', ...rest] : [];
};
const paintAccounts = async () => {
  const {accounts} = await store.get({accounts: {}});
  const {'cached-objects': objs} = await chrome.storage.session.get({'cached-objects': []});
  // labels belong to the account's slot in the browser, /mail/u/<n>
  const slot = {};
  for (const o of objs) {
    const m = /\/u\/(\d+)/.exec(o.xml.rootLink || o.xml.link || '');
    if (m) {
      slot[o.xml.title] = Number(m[1]);
    }
  }
  const names = Object.keys(accounts);
  if (names.length === 0) {
    $('accounts').replaceChildren(h('p', {className: 'empty', textContent: t('noInboxes')}));
    return;
  }
  $('accounts').replaceChildren(...names.map(name => {
    // one account's change keeps what is stored for the others
    const update = values => store.get({accounts: {}}).then(p => {
      p.accounts[name] = {...p.accounts[name], ...values};
      return save({accounts: p.accounts});
    });
    const chip = (text, checked, onchange, className = '') => h('label', {className},
      h('input', {type: 'checkbox', checked, onchange}), h('span', {textContent: text}));

    const toggle = h('input', {type: 'checkbox', checked: accounts[name].ignored !== true});
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-label', t('showInbox', name));
    // a quiet inbox stays in the panel and the badge, without notifications or sound
    const notify = chip(t('notifyChip'), accounts[name].quiet !== true, ev => update({quiet: !ev.target.checked}));
    const n = slot[name];
    let primary = null;
    let labels = null;
    if (n !== undefined && n < 10) {
      labels = h('input', {type: 'text', className: 'labels', value: prefs['feeds_' + n], placeholder: t('labelsPlaceholder'), spellcheck: false});
      labels.setAttribute('aria-label', t('labelsFor', name));
      labels.onchange = () => {
        labels.value = cleanLabels(labels.value);
        primary.firstChild.checked = hasPrimary(labels.value);
        save({['feeds_' + n]: labels.value});
      };
      primary = chip(t('primaryChip'), hasPrimary(labels.value), ev => {
        labels.value = cleanLabels(withPrimary(labels.value, ev.target.checked).join(', '));
        save({['feeds_' + n]: labels.value});
      }, 'adv');
      labels.classList.add('adv');
    }
    const options = h('span', {className: 'options'}, h('span', {className: 'chips'}, notify, primary), labels);
    const paintShown = () => {
      options.classList.toggle('off', !toggle.checked);
      options.querySelectorAll('input').forEach(el => el.disabled = !toggle.checked);
    };
    toggle.onchange = () => {
      paintShown();
      update({ignored: !toggle.checked});
    };
    paintShown();
    const service = self.MailServices?.[accounts[name].service];
    return h('div', {className: 'row'},
      h('span', {className: 'face', textContent: name[0].toUpperCase()}),
      h('span', {className: 'text'}, h('b', {textContent: name}, service && h('span', {className: 'tag', textContent: service.name})), options),
      toggle);
  }));
};

/* the other mail services: each asks Chrome for its sites when it is turned on */
const paintServices = async () => {
  const granted = await Promise.all(SERVICES.map(s => chrome.permissions.contains({origins: s.origins})));
  $('service-list').replaceChildren(...SERVICES.map((s, i) => {
    const toggle = h('input', {type: 'checkbox', checked: prefs.services.includes(s.id) && granted[i]});
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-label', s.name);
    toggle.onchange = () => {
      const on = toggle.checked;
      // Chrome asks only from the click itself, before anything is awaited
      const asked = on ? chrome.permissions.request({origins: s.origins}) : chrome.permissions.remove({origins: s.origins});
      asked.catch(() => false).then(ok => {
        if (on && !ok) {
          toggle.checked = false;
          return;
        }
        const ids = prefs.services.filter(id => id !== s.id);
        save({services: on ? [...ids, s.id] : ids});
      });
    };
    const signIn = h('a', {href: s.signIn, target: '_blank', textContent: t('serviceSignIn')});
    return h('div', {className: 'row'},
      h('span', {className: 'face', textContent: s.name[0]}),
      h('span', {className: 'text'}, h('b', {textContent: s.name}), h('small', {}, new URL(s.hosts[0]).host, ' · ', signIn)),
      toggle);
  }));
};
// the panel's link to this section
if (location.hash === '#services') {
  addEventListener('load', () => $('services').scrollIntoView({block: 'start'}));
}
$('forget').onclick = () => store.remove('accounts').then(() => {
  toast(t('forgotten'));
  paintAccounts();
});

/* the panel's shortcut: Chrome keeps it, and changes it on chrome://extensions/shortcuts */
const paintShortcut = () => chrome.commands.getAll(commands => {
  const key = commands.find(c => c.name === '_execute_action')?.shortcut;
  $('shortcut').replaceChildren(key ? h('kbd', {textContent: key}) : h('span', {className: 'none', textContent: t('shortcutNone')}));
});
$('shortcut-change').onclick = () => chrome.tabs.create({url: 'chrome://extensions/shortcuts'});
// coming back from the shortcuts page
addEventListener('focus', paintShortcut);

/* backup: a settings file, and a copy in Chrome sync */
// what a backup holds: this page's settings and the inboxes' switches, not caches or the mail already seen
const SOUND_FILES = MEDIA.flatMap(m => [m + '.file', m + '.mime']);
// An own sound is the file this page read (pickFile): a data: URL of audio or video, never an
// address to fetch, which would tell its owner each time mail comes. The local storage holds
// 10 MB in all, so no own sound saved here is larger. core/offscreen/index.js checks the same.
const SOUND_MAX = 10 * 1024 * 1024;
const soundFile = v => typeof v === 'string' && v.length <= SOUND_MAX &&
  /^data:(audio|video)\/[\w.+-]+(;\s*[\w.+-]+=[\w.+"-]+)*;base64,/i.test(v.slice(0, 200));
const soundMime = v => typeof v === 'string' && /^(audio|video)\/[\w.+-]+$/i.test(v);
const collect = files => store.get({
  ...Object.fromEntries(Object.entries(DEFAULTS).filter(([k]) => k !== 'sync.settings')),
  accounts: {},
  ...(files ? Object.fromEntries(SOUND_FILES.map(k => [k, null])) : {})
});
// keeps only what a backup may hold, each value of its setting's type
const sanitize = data => {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (k in DEFAULTS && k !== 'sync.settings' && k !== 'services' && typeof v === typeof DEFAULTS[k] && (typeof v !== 'number' || (Number.isFinite(v) && v >= 0))) {
      out[k] = v;
    }
    else if (k === 'accounts' && v && typeof v === 'object' && !Array.isArray(v)) {
      out.accounts = Object.fromEntries(Object.entries(v).map(([name, o]) => [name, {
        ignored: o?.ignored === true,
        quiet: o?.quiet === true,
        ...(self.MailServices?.[o?.service] ? {service: o.service} : {})
      }]));
    }
    else if (k === 'services' && Array.isArray(v)) {
      out.services = v.filter(id => typeof id === 'string' && self.MailServices?.[id]);
    }
    else if (SOUND_FILES.includes(k) && (v === null || (k.endsWith('.file') ? soundFile(v) : soundMime(v)))) {
      out[k] = v;
    }
  }
  // an own sound whose file did not come along, or came as anything but a sound, plays the
  // built-in one; so does a sound this page does not offer (0-3 built in, 4 own file)
  for (const m of MEDIA) {
    if ((out[m + '.type'] === 4 && !out[m + '.file']) || (m + '.type' in out && ![0, 1, 2, 3, 4].includes(out[m + '.type']))) {
      out[m + '.type'] = 0;
    }
  }
  return out;
};

$('export').onclick = async () => {
  const data = {
    app: 'mail-deck',
    version: chrome.runtime.getManifest().version,
    exported: new Date().toISOString(),
    settings: await collect(true)
  };
  const a = h('a', {
    href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'})),
    download: `mail-deck-settings-${data.exported.slice(0, 10)}.json`
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('import').onclick = () => {
  const input = $('settings-file');
  input.value = '';
  input.onchange = () => input.files[0].text().then(text => {
    const data = JSON.parse(text);
    if (data?.app !== 'mail-deck' || !data.settings || typeof data.settings !== 'object') {
      throw Error('not a Mail Deck file');
    }
    if (confirm(t('importConfirm'))) {
      return store.set(sanitize(data.settings)).then(() => reloadWith(t('imported')));
    }
  }).catch(() => toast(t('importBad')));
  input.click();
};

// Chrome sync holds 8 KB an item: the settings go as JSON cut in pieces, with a note of how many
const SYNC = 'settings.';
const PIECE = 2400; // characters; even at three bytes each a piece fits QUOTA_BYTES_PER_ITEM
const pieceKeys = n => [...Array(n).keys()].map(i => SYNC + i);
let syncTimer;
const pushSync = () => {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const text = JSON.stringify(await collect(false));
      const n = Math.ceil(text.length / PIECE);
      const pieces = Object.fromEntries(pieceKeys(n).map((k, i) => [k, text.slice(i * PIECE, (i + 1) * PIECE)]));
      const {[SYNC + 'meta']: old} = await chrome.storage.sync.get(SYNC + 'meta');
      await chrome.storage.sync.set({...pieces, [SYNC + 'meta']: {n, at: Date.now()}});
      if (old?.n > n) {
        await chrome.storage.sync.remove(pieceKeys(old.n).slice(n));
      }
    }
    catch (e) {
      toast(t('syncFailed'));
    }
  }, 1500);
};
const readSync = async () => {
  const {[SYNC + 'meta']: meta} = await chrome.storage.sync.get(SYNC + 'meta');
  if (!meta?.n) {
    return null;
  }
  const pieces = await chrome.storage.sync.get(pieceKeys(meta.n));
  try {
    return {at: meta.at, settings: JSON.parse(pieceKeys(meta.n).map(k => pieces[k] || '').join(''))};
  }
  catch (e) {
    return null;
  }
};
const dropSync = async () => {
  clearTimeout(syncTimer);
  const {[SYNC + 'meta']: meta} = await chrome.storage.sync.get(SYNC + 'meta');
  await chrome.storage.sync.remove([SYNC + 'meta', ...pieceKeys(meta?.n || 0)]);
};
// a fresh install, with nothing set on this page yet, offers the copy another computer keeps
const offerRestore = async () => {
  const local = await store.get(null);
  if (Object.keys(DEFAULTS).some(k => k in local)) {
    return;
  }
  const backup = await readSync();
  if (!backup) {
    return;
  }
  $('restore-text').textContent = t('restoreText', new Date(backup.at).toLocaleDateString(chrome.i18n.getUILanguage(), {dateStyle: 'long'}));
  $('restore').hidden = false;
  $('restore-no').onclick = () => $('restore').hidden = true;
  $('restore-yes').onclick = () => store.set({...sanitize(backup.settings), 'sync.settings': true})
    .then(() => reloadWith(t('restored')));
};

/* diagnostics: every signed-in inbox asked live; read only, no action is ever sent */
const DIAG_MS = 8000;
const within = promise => Promise.race([promise, new Promise((resolve, reject) => setTimeout(reject, DIAG_MS, Error('timeout')))]);
const page = async url => {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), DIAG_MS);
  try {
    return await fetch(url, {credentials: 'include', cache: 'no-store', signal: c.signal});
  }
  finally {
    clearTimeout(id);
  }
};
// [name, true | false | null (skipped), why]
const check = (name, run) => run().then(([ok, why]) => [name, ok, why], () => [name, false, t('diagNoAnswer')]);
const answered = r => [false, t('diagStatus', r.status)];
// a mailbox of another service: the background asks the service the way a check does
const serviceChecks = id => Promise.all([check('diagService', async () => {
  const r = await within(chrome.runtime.sendMessage({method: 'services.check', id}));
  if (!r || r.message) {
    return [false, r?.message || t('diagNoAnswer')];
  }
  return r.boxes.length ? [true, r.boxes.map(b => `${b.email}: ${t('diagUnread', b.unread)}`).join(', ')] : [false, t('diagSignedOut')];
})]);
const inboxChecks = o => {
  if (o.xml.service) {
    return serviceChecks(o.xml.service);
  }
  const root = (o.xml.rootLink || '').replace(/\/$/, '');
  const n = (/\/u\/(\d+)/.exec(root) || [])[1];
  const thread = (/message_id=([^&]+)/.exec(o.xml.entries?.[0]?.link || '') || [])[1];
  return Promise.all([
    check('diagFeed', async () => {
      const r = await page(root + '/feed/atom');
      // Gmail sends a signed-out slot back to the first account
      if (r.url.includes('/u/0/') && !root.endsWith('/u/0')) {
        return [false, t('diagSignedOut')];
      }
      return r.ok ? [true, t('diagOk')] : answered(r);
    }),
    check('diagSearch', async () => {
      const entries = await within(chrome.runtime.sendMessage({method: 'gmail.search', url: root, query: 'in:inbox'}));
      return Array.isArray(entries) ? [true, t('diagFound', entries.length)] : [false, t('diagNoAnswer')];
    }),
    check('diagToken', async () => {
      const at = await within(chrome.runtime.sendMessage({method: 'get-at', n}));
      return at ? [true, t('diagOk')] : [false, t('diagOpenGmail')];
    }),
    // the print view the panel reads a message from, with the panel's msg= and its th= fallback
    check('diagPrint', async () => {
      if (!thread) {
        return [null, t('diagNoMail')];
      }
      let r = await page(`${root}/?ui=2&view=pt&dsqt=1&search=all&msg=${thread}`);
      if (r.status === 400) {
        r = await page(`${root}/?ui=2&view=pt&dsqt=1&search=all&th=${thread}`);
      }
      if (!r.ok) {
        return answered(r);
      }
      return /class="?message/.test(await r.text()) ? [true, t('diagOk')] : [false, t('diagNoMessage')];
    }),
    check('diagPrimary', async () => {
      const r = await page(root + '/feed/atom/%5Esmartlabel_personal');
      return r.ok ? [true, t('diagOk')] : answered(r);
    })
  ]);
};
const browserChecks = () => Promise.all([
  check('diagSide', async () => chrome.sidePanel ? [true, t('diagOk')] : [false, t('diagNoSide')]),
  check('diagShortcut', async () => {
    const commands = await chrome.commands.getAll();
    const key = commands.find(c => c.name === '_execute_action')?.shortcut;
    return key ? [true, key] : [false, t('shortcutNone')];
  })
]);
const diagBlock = (title, lines) => h('div', {className: 'diag-block'},
  h('b', {textContent: title}),
  h('ul', {}, ...lines.map(([name, ok, why]) => h('li', {className: ok ? 'ok' : ok === null ? 'skip' : 'bad'},
    h('span', {className: 'mark', textContent: ok ? '✓' : ok === null ? '–' : '✗'}),
    h('span', {className: 'name', textContent: t(name)}),
    h('span', {className: 'why', textContent: why})))));
$('diag-run').onclick = async () => {
  const button = $('diag-run');
  const out = $('diag');
  button.disabled = true;
  button.textContent = t('diagRunning');
  out.hidden = false;
  out.replaceChildren();
  const {'cached-objects': objs} = await chrome.storage.session.get({'cached-objects': []});
  // labels watched in an inbox share its account: one round per account
  // a service answers for all its mailboxes at once: one round per service
  const inboxes = objs.filter((o, i) => objs.findIndex(x => o.xml.service ? x.xml.service === o.xml.service : x.xml.rootLink === o.xml.rootLink) === i);
  // a service turned on without a mailbox in the panel is checked as well
  const quiet = (await Promise.all(SERVICES.filter(s => prefs.services.includes(s.id) && !inboxes.some(o => o.xml.service === s.id))
    .map(async s => await chrome.permissions.contains({origins: s.origins}) ? s : null))).filter(Boolean);
  const [rounds, browser, away] = await Promise.all([Promise.all(inboxes.map(inboxChecks)), browserChecks(), Promise.all(quiet.map(s => serviceChecks(s.id)))]);
  const title = o => o.xml.service ? self.MailServices?.[o.xml.service]?.name || o.xml.title : o.xml.title;
  out.replaceChildren(
    ...(inboxes.length ? inboxes.map((o, i) => diagBlock(title(o), rounds[i])) : [h('p', {className: 'empty', textContent: t('diagNone')})]),
    ...quiet.map((s, i) => diagBlock(s.name, away[i])),
    diagBlock(t('diagBrowser'), browser));
  button.disabled = false;
  button.textContent = t('diagRun');
};

/* the rest */
$('reset').onclick = () => {
  if (confirm(t('resetConfirm'))) {
    // the copy in Chrome sync stays on and follows the defaults
    store.set({...DEFAULTS, 'sync.settings': prefs['sync.settings'], accounts: {}}).then(() => location.reload());
  }
};
document.addEventListener('click', ({target}) => {
  if (target.id === 'play') {
    chrome.runtime.sendMessage({method: 'test-play'});
  }
});

let scope = 'essentials';
try {
  scope = localStorage.getItem('scope') || scope;
}
catch (e) {}
document.body.dataset.scope = scope;
document.querySelector(`input[name="scope"][value="${scope}"]`).checked = true;

document.title = t('settingsTitle');
document.documentElement.lang = chrome.i18n.getUILanguage();
// Arabic and Hebrew read from the right: the layout mirrors with them
document.documentElement.dir = chrome.i18n.getMessage('@@bidi_dir') || 'ltr';
for (const el of document.querySelectorAll('[data-i18n]')) {
  el.textContent = t(el.dataset.i18n, ...(el.dataset.i18nArg ? [el.dataset.i18nArg] : []));
}
for (const el of document.querySelectorAll('[data-i18n-label]')) {
  el.setAttribute('aria-label', t(el.dataset.i18nLabel));
}
try {
  const said = sessionStorage.getItem('toast');
  if (said) {
    sessionStorage.removeItem('toast');
    toast(said);
  }
}
catch (e) {}

store.get(DEFAULTS).then(stored => {
  prefs = stored;
  paintFields();
  paintSwatches();
  $('default-sound').replaceChildren(soundPicker(MEDIA[0]), h('button', {type: 'button', className: 'ghost', id: 'play', textContent: t('play')}));
  paintRules();
  syncNeeds();
  paintShortcut();
  // the background adds inboxes on its own; the copy catches up when the page opens
  if (prefs['sync.settings']) {
    pushSync();
  }
  offerRestore();
  paintServices();
  return paintAccounts();
});
