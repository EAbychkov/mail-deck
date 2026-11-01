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
// What a setting may hold beyond its type: what this page offers, and what an older or
// hand-edited backup can sensibly bring. Anything else in a backup is left out.
const int = (min, max) => v => Number.isInteger(v) && v >= min && v <= max;
const oneOf = (...list) => v => list.includes(v);
const upTo = n => v => v.length <= n;
const TIME = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const VALID = {
  'period': int(30, 3600), // seconds; Chrome's alarms come no faster than every 30 s
  'initialPeriod': int(0, 600),
  'notificationTime': int(1, 600),
  'threatAsNew': int(0, 43200), // minutes
  'notificationTruncate': int(10, 10000),
  'silentTime': int(1, 1440), // minutes
  'soundVolume': int(0, 100), // an audio volume over 100% throws, and no sound plays at all
  'oldFashion': oneOf(0, 1, 2),
  'panelScale': v => v >= 0.5 && v <= 2,
  'backgroundColor': v => /^#[0-9a-f]{6}$/i.test(v),
  'quiet.from': TIME,
  'quiet.to': TIME,
  'notificationFormat': upTo(2000),
  'notify.never': upTo(20000),
  'notify.only': upTo(20000)
};
for (const m of MEDIA.slice(1)) {
  VALID[m + '.selector'] = oneOf(0, 1, 2);
  VALID[m + '.filter'] = upTo(200);
}
for (let i = 0; i < 10; i += 1) {
  VALID['feeds_' + i] = upTo(2000);
}

const store = chrome.storage.local;
// what the background last read: one object per inbox, label and mailbox
const sessionObjects = () => chrome.storage.session.get({'cached-objects': []}).then(r => r['cached-objects'] || []);
// Gmail's accounts by address, each with its slot in the browser, /mail/u/<n>, where its labels
// belong (feeds_<n>). A mailbox of another service is not one: Proton's links have a /u/<n> too.
const gmailSlots = objs => {
  const slot = {};
  for (const o of objs) {
    const m = o?.xml?.service ? null : /\/u\/(\d+)/.exec(o?.xml?.rootLink || o?.xml?.link || '');
    if (m && o.xml.title && Number(m[1]) < 10) {
      slot[o.xml.title] = Number(m[1]);
    }
  }
  return slot;
};
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
// quiet hours that start when they end quiet nothing (core/utils/quiet.js): the row says so
const paintQuiet = () => {
  $('quiet-same').hidden = prefs['quiet.from'] !== prefs['quiet.to'];
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
    // a cleared time keeps the one before it
    else if (target.type === 'time') {
      if (!/^\d\d:\d\d/.test(value)) {
        target.value = prefs[key];
        return;
      }
      value = value.slice(0, 5);
    }
    save({[key]: value});
    syncNeeds();
    paintQuiet();
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
    field.setAttribute('aria-label', t('ruleField'));
    field.value = prefs[m + '.selector'];
    field.onchange = () => save({[m + '.selector']: Number(field.value)});
    const word = h('input', {type: 'text', value: prefs[m + '.filter'], placeholder: t('rulePlaceholder'), spellcheck: false});
    word.setAttribute('aria-label', t('rulePlaceholder'));
    word.onchange = () => save({[m + '.filter']: word.value.trim()});
    const remove = h('button', {type: 'button', className: 'ghost round', textContent: '×', title: t('ruleRemove')});
    remove.setAttribute('aria-label', t('ruleRemove'));
    remove.onclick = () => {
      shownRules.delete(i);
      // the row and its button go: the focus stays in the list, on adding another
      save({[m + '.filter']: '', [m + '.selector']: 0, [m + '.type']: 0}).then(() => {
        paintRules();
        $('add-rule').focus();
      });
    };
    const row = h('div', {className: 'rule'}, field, word, soundPicker(m), remove);
    row.dataset.rule = i;
    return row;
  }));
  $('add-rule').hidden = shownRules.size >= 5;
  syncNeeds();
};
$('add-rule').onclick = () => {
  const free = [0, 1, 2, 3, 4].find(i => !shownRules.has(i));
  shownRules.add(free);
  paintRules();
  // the rows go in their order, so the new one is not always the last
  $('rules').querySelector(`[data-rule="${free}"] input`).focus();
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
// each inbox row's switches, so that a change made elsewhere (the toolbar menu, a check that
// finds a new inbox) shows here: in place, or with the list drawn again when inboxes come or go
const accountRows = new Map();
const accountsShape = accounts => JSON.stringify(Object.entries(accounts || {}).map(([name, o]) => [name, o?.service || '']));
let shownShape = null;
const followAccounts = accounts => {
  if (accountsShape(accounts) !== shownShape) {
    return paintAccounts();
  }
  for (const [name, row] of accountRows) {
    row.toggle.checked = accounts[name]?.ignored !== true;
    row.notify.checked = accounts[name]?.quiet !== true;
    row.paintShown();
  }
};
const paintAccounts = async () => {
  const {accounts} = await store.get({accounts: {}});
  // labels belong to a Gmail account's slot in the browser
  const slot = gmailSlots(await sessionObjects());
  accountRows.clear();
  shownShape = accountsShape(accounts);
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
    if (n !== undefined && !accounts[name].service) {
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
    accountRows.set(name, {toggle, notify: notify.firstChild, paintShown});
    const service = self.MailServices?.[accounts[name].service];
    return h('div', {className: 'row'},
      h('span', {className: 'face', textContent: name[0].toUpperCase()}),
      h('span', {className: 'text'}, h('b', {textContent: name}, service && h('span', {className: 'tag', textContent: service.name})), options),
      toggle);
  }));
};

/* the other mail services: each asks Chrome for its sites when it is turned on */
// A switch shows on only while the settings want the service and Chrome gives it its sites (the
// background checks both). One the settings want without the sites, as after a restore on
// another computer, says to turn it on again. The rows stay; their state follows in place.
const serviceRows = new Map();
const asking = new Set();
const syncServices = async () => {
  const granted = await Promise.all(SERVICES.map(s => chrome.permissions.contains({origins: s.origins}).catch(() => false)));
  SERVICES.forEach((s, i) => {
    const row = serviceRows.get(s.id);
    if (row && !asking.has(s.id)) {
      const wanted = (prefs.services || []).includes(s.id);
      row.toggle.checked = wanted && granted[i];
      row.note.hidden = !wanted || granted[i];
    }
  });
};
const paintServices = () => {
  serviceRows.clear();
  $('service-list').replaceChildren(...SERVICES.map(s => {
    const toggle = h('input', {type: 'checkbox'});
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-label', s.name);
    const note = h('small', {className: 'note', id: 'service-note-' + s.id, textContent: t('serviceAccess'), hidden: true});
    toggle.setAttribute('aria-describedby', note.id);
    toggle.onchange = () => {
      const on = toggle.checked;
      asking.add(s.id);
      // Chrome asks only from the click itself, before anything is awaited
      const asked = on ? chrome.permissions.request({origins: s.origins}) : chrome.permissions.remove({origins: s.origins});
      asked.catch(() => false).then(ok => {
        // on with its sites, or off; a refusal turns it off in the settings too
        const ids = prefs.services.filter(id => id !== s.id);
        const next = on && ok ? [...ids, s.id] : ids;
        if (next.join() !== prefs.services.join()) {
          return save({services: next});
        }
      }).finally(() => {
        asking.delete(s.id);
        syncServices();
      });
    };
    serviceRows.set(s.id, {toggle, note});
    const signIn = h('a', {href: s.signIn, target: '_blank', textContent: t('serviceSignIn')});
    return h('div', {className: 'row'},
      h('span', {className: 'face', textContent: s.name[0]}),
      h('span', {className: 'text'}, h('b', {textContent: s.name}), h('small', {}, new URL(s.hosts[0]).host, ' · ', signIn), note),
      toggle);
  }));
  return syncServices();
};
// a backup or a reset that leaves services off gives Chrome back their sites
const revokeOff = ids => {
  const origins = SERVICES.filter(s => !ids.includes(s.id)).flatMap(s => s.origins);
  return origins.length ? chrome.permissions.remove({origins}).catch(() => false) : Promise.resolve(true);
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
// with the panel's order of the mailboxes, and each Gmail account's labels under its address
// as well: another computer that signed in to the accounts in another order puts them right
const collect = async files => {
  const settings = await store.get({
    ...Object.fromEntries(Object.entries(DEFAULTS).filter(([k]) => k !== 'sync.settings')),
    accounts: {},
    accountOrder: [],
    ...(files ? Object.fromEntries(SOUND_FILES.map(k => [k, null])) : {})
  });
  const slot = gmailSlots(await sessionObjects());
  settings.labels = Object.fromEntries(Object.entries(slot).map(([email, n]) => [email, settings['feeds_' + n]]));
  return settings;
};
// keeps only what a backup may hold, each value of its setting's type and within its range
const sanitize = data => {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (k in DEFAULTS && k !== 'sync.settings' && k !== 'services' && typeof v === typeof DEFAULTS[k] &&
      (typeof v !== 'number' || (Number.isFinite(v) && v >= 0)) && (!VALID[k] || VALID[k](v))) {
      out[k] = v;
    }
    else if (k === 'accounts' && v && typeof v === 'object' && !Array.isArray(v)) {
      out.accounts = Object.fromEntries(Object.entries(v).map(([name, o]) => [name, {
        ignored: o?.ignored === true,
        quiet: o?.quiet === true,
        // an address hidden from the panel's signed-out list stays hidden
        ...(o?.signedOutHidden === true ? {signedOutHidden: true} : {}),
        ...(self.MailServices?.[o?.service] ? {service: o.service} : {})
      }]));
    }
    else if (k === 'accountOrder' && Array.isArray(v)) {
      out.accountOrder = v.filter((name, i) => typeof name === 'string' && v.indexOf(name) === i).slice(0, 100);
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
// A Gmail account signed in here gets the labels the backup keeps under its address, or keeps
// its own: never those of whichever account had its slot on the other computer. With no
// account known here yet (a fresh install before its first check) the slots stay as they came.
const placeLabels = (out, labels, slot) => {
  for (const n of new Set(Object.values(slot))) {
    delete out['feeds_' + n];
  }
  for (const [email, value] of Object.entries(labels)) {
    const n = slot[email];
    if (n !== undefined && typeof value === 'string' && VALID['feeds_' + n](value)) {
      out['feeds_' + n] = value;
    }
  }
  return out;
};
// a backup as this computer keeps it
const restorable = async settings => {
  const out = sanitize(settings);
  const labels = settings?.labels;
  if (labels && typeof labels === 'object' && !Array.isArray(labels)) {
    placeLabels(out, labels, gmailSlots(await sessionObjects()));
  }
  return out;
};
const apply = async values => {
  await store.set(values);
  if (Array.isArray(values.services)) {
    await revokeOff(values.services);
  }
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
      return restorable(data.settings).then(apply).then(() => reloadWith(t('imported')));
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
  $('restore-yes').onclick = () => restorable(backup.settings).then(out => apply({...out, 'sync.settings': true}))
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
    // the copy in Chrome sync stays on and follows the defaults; the services go off, their sites too
    apply({...DEFAULTS, 'sync.settings': prefs['sync.settings'], accounts: {}}).then(() => location.reload());
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
  paintQuiet();
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
  // what changes while the page is open: inboxes the background finds, the toolbar menu's
  // switches, a service's sites given or taken on chrome://extensions
  chrome.storage.onChanged.addListener((ps, area) => {
    if (area !== 'local') {
      return;
    }
    if (ps.services) {
      prefs.services = ps.services.newValue || [];
      syncServices();
    }
    if (ps.accounts) {
      followAccounts(ps.accounts.newValue || {});
    }
  });
  chrome.permissions.onAdded?.addListener(() => syncServices());
  chrome.permissions.onRemoved?.addListener(() => syncServices());
  return paintAccounts();
});
