// The settings page's own logic (extension/data/settings/index.js) in node: what a backup may
// bring, where an account's labels go, which services keep their sites, and the quiet hours'
// times. The page runs in a vm with a small document and chrome.*; nothing is drawn.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const EXT = path.join(__dirname, '../../extension');
const en = JSON.parse(fs.readFileSync(path.join(EXT, '_locales/en/messages.json'), 'utf8'));

// a document just big enough for the page to start: elements by id, and the listeners it adds
const elements = new Map();
const element = id => {
  if (!elements.has(id)) {
    elements.set(id, {
      id, hidden: false, value: '', checked: false, dataset: {}, style: {setProperty() {}},
      classList: {add() {}, remove() {}, toggle() {}},
      setAttribute() {}, focus() {}, append() {}, replaceChildren() {}, add() {}, click() {},
      querySelector: () => element('(query)'), querySelectorAll: () => []
    });
  }
  return elements.get(id);
};
const listeners = {};
let made = 0;
const document = {
  getElementById: element,
  querySelector: () => element('(query)'),
  querySelectorAll: () => [],
  addEventListener: (type, fn) => listeners[type] = fn,
  createElement: () => element('(new ' + (made += 1) + ')'),
  documentElement: {},
  body: {dataset: {}}
};

// chrome.*: storage in plain objects, what the page asks of Chrome written down
const local = {};
let session = {'cached-objects': []};
const set = [];
const removed = [];
const store = {
  // the page's own start waits for this forever: the checks below call its parts one by one
  get: () => new Promise(() => {}),
  set: async values => {
    set.push(values);
    Object.assign(local, values);
  },
  remove: async () => {}
};
const chrome = {
  i18n: {
    getMessage: (key, subs = []) => (en[key]?.message || '').replace(/\$(\d)/g, (_, i) => subs[i - 1] ?? ''),
    getUILanguage: () => 'en'
  },
  storage: {
    local: store,
    session: {get: async defaults => ({...defaults, ...session})},
    sync: {get: async () => ({}), set: async () => {}, remove: async () => {}},
    onChanged: {addListener() {}}
  },
  permissions: {
    contains: async () => true,
    request: async () => true,
    remove: async ({origins}) => {
      removed.push(...origins);
      return true;
    },
    onAdded: {addListener() {}},
    onRemoved: {addListener() {}}
  },
  commands: {getAll: () => Promise.resolve([])},
  runtime: {getManifest: () => ({version: '0'}), sendMessage: async () => null},
  tabs: {create() {}}
};

const ctx = {document, chrome, location: {hash: '', reload() {}}, addEventListener() {}, confirm: () => true,
  setTimeout, clearTimeout, URL, Blob, console};
ctx.self = ctx;
vm.createContext(ctx);
// the page's scripts in its order: the mail services first, then the page
const html = fs.readFileSync(path.join(EXT, 'data/settings/index.html'), 'utf8');
for (const [, src] of html.matchAll(/<script src="([^"]+)"/g)) {
  const file = src.startsWith('/') ? path.join(EXT, src) : path.join(EXT, 'data/settings', src);
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, {filename: file});
}
const page = code => vm.runInContext(code, ctx);
// from here on the page reads what the checks put in local
store.get = async defaults => {
  if (defaults === null) {
    return {...local};
  }
  return Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, k in local ? local[k] : v]));
};

let n = 0;
const checks = [];
const check = (name, fn) => checks.push([name, fn]);

const gmail = (n, email) => ({meta: {}, xml: {title: email, rootLink: `https://mail.google.com/mail/u/${n}`, link: `https://mail.google.com/mail/u/${n}/#inbox`}});
const proton = (n, email) => ({meta: {service: 'proton'}, xml: {title: email, service: 'proton', rootLink: `https://mail.proton.me/u/${n}/inbox`, link: `https://mail.proton.me/u/${n}/inbox`}});

check('a backup keeps what is in range and leaves out the rest', () => {
  const sanitize = page('sanitize');
  const good = {
    'period': 300, 'initialPeriod': 0, 'soundVolume': 100, 'panelScale': 1.1, 'oldFashion': 2,
    'quiet.from': '22:30', 'quiet.to': '07:05', 'backgroundColor': '#12AB9f', 'notificationTruncate': 150,
    'notification.sound.media.custom0.selector': 2, 'notification.sound.media.custom0.filter': 'boss',
    'feeds_3': 'inbox, work', 'notify.never': 'news\nnoreply@', 'alert': false
  };
  assert.deepStrictEqual({...sanitize(good)}, good);
  const bad = {
    'period': 1, 'initialPeriod': 0.5, 'soundVolume': 500, 'panelScale': 40, 'oldFashion': 9, 'silentTime': 0,
    'quiet.from': 'abc', 'quiet.to': '24:00', 'backgroundColor': 'red', 'notificationTime': -5,
    'notification.sound.media.custom1.selector': 7, 'notification.sound.media.custom1.filter': 'x'.repeat(201),
    'notify.only': 'x'.repeat(20001), 'alert': 'yes', 'sync.settings': true, 'unknown': 1
  };
  assert.deepStrictEqual({...sanitize(bad)}, {});
});
check('a backup keeps the security checks on own sounds', () => {
  const out = page('sanitize')({
    'notification.sound.media.default.type': 4,
    'notification.sound.media.default.file': 'https://tracker.example/ping.mp3',
    'notification.sound.media.custom0.type': 9
  });
  assert.strictEqual(out['notification.sound.media.default.file'], undefined);
  assert.strictEqual(out['notification.sound.media.default.type'], 0);
  assert.strictEqual(out['notification.sound.media.custom0.type'], 0);
});
check('a backup keeps the panel order and the addresses hidden from it', () => {
  const out = page('sanitize')({
    accountOrder: ['b@gmail.com', 'a@gmail.com', 'b@gmail.com', 7],
    accounts: {'a@gmail.com': {ignored: true, signedOutHidden: true, other: 'x'}, 'y@yahoo.com': {service: 'yahoo'}, 'z@x.com': {service: 'nope'}},
    services: ['yahoo', 'nope', 3]
  });
  assert.deepStrictEqual([...out.accountOrder], ['b@gmail.com', 'a@gmail.com']);
  assert.deepStrictEqual({...out.accounts['a@gmail.com']}, {ignored: true, quiet: false, signedOutHidden: true});
  assert.deepStrictEqual({...out.accounts['y@yahoo.com']}, {ignored: false, quiet: false, service: 'yahoo'});
  assert.deepStrictEqual({...out.accounts['z@x.com']}, {ignored: false, quiet: false});
  assert.deepStrictEqual([...out.services], ['yahoo']);
});
check('labels belong to Gmail accounts only, not to a Proton mailbox at /u/0', () => {
  const slots = page('gmailSlots')([gmail(0, 'a@gmail.com'), proton(0, 'me@proton.me'), gmail(1, 'b@gmail.com'), gmail(12, 'far@gmail.com')]);
  assert.deepStrictEqual({...slots}, {'a@gmail.com': 0, 'b@gmail.com': 1});
});
check('an export holds the panel order and the labels under each address', async () => {
  Object.assign(local, {feeds_0: 'inbox, a-work', feeds_1: '^smartlabel_personal', accountOrder: ['b@gmail.com']});
  session = {'cached-objects': [gmail(0, 'a@gmail.com'), gmail(1, 'b@gmail.com'), proton(0, 'me@proton.me')]};
  const out = await page('collect(false)');
  assert.deepStrictEqual([...out.accountOrder], ['b@gmail.com']);
  assert.deepStrictEqual({...out.labels}, {'a@gmail.com': 'inbox, a-work', 'b@gmail.com': '^smartlabel_personal'});
  assert.strictEqual('notification.sound.media.default.file' in out, false);
  assert.strictEqual('notification.sound.media.default.file' in await page('collect(true)'), true);
});
check('restored labels follow their account to its slot here', async () => {
  const backup = {feeds_0: 'a-labels', feeds_1: 'b-labels', feeds_5: 'old', labels: {'a@gmail.com': 'a-labels', 'b@gmail.com': 'b-labels'}};
  // here b signed in first, a second, and c, unknown to the backup, third
  session = {'cached-objects': [gmail(0, 'b@gmail.com'), gmail(1, 'a@gmail.com'), gmail(2, 'c@gmail.com')]};
  const out = await page('restorable')(backup);
  assert.strictEqual(out.feeds_0, 'b-labels');
  assert.strictEqual(out.feeds_1, 'a-labels');
  assert.strictEqual('feeds_2' in out, false, 'c keeps its own labels');
  assert.strictEqual(out.feeds_5, 'old', 'a slot no account here has comes as it was');
  // a fresh install before its first check knows no account: the slots come as they were
  session = {'cached-objects': []};
  const fresh = await page('restorable')(backup);
  assert.strictEqual(fresh.feeds_0, 'a-labels');
  assert.strictEqual(fresh.feeds_1, 'b-labels');
  // a labels entry that is not a string, or too long, is not used
  session = {'cached-objects': [gmail(0, 'a@gmail.com')]};
  const odd = await page('restorable')({feeds_0: 'x', labels: {'a@gmail.com': 5}});
  assert.strictEqual('feeds_0' in odd, false);
});
check('a restore gives back the sites of the services it leaves off', async () => {
  removed.length = 0;
  await page('apply')({services: ['yahoo']});
  const all = Object.values(ctx.MailServices);
  const want = all.filter(s => s.id !== 'yahoo').flatMap(s => s.origins).sort();
  assert.deepStrictEqual(removed.sort(), want);
  assert.ok(!removed.some(o => o.includes('yahoo')));
  // a reset turns them all off; a backup without services leaves them as they are
  removed.length = 0;
  await page('apply')({...page('DEFAULTS')});
  assert.deepStrictEqual(removed.sort(), all.flatMap(s => s.origins).sort());
  removed.length = 0;
  await page('apply')({alert: true});
  assert.deepStrictEqual(removed, []);
});
check('a cleared time keeps the one before; equal ends are saved and get a note', async () => {
  page(`prefs = {'quiet.from': '22:00', 'quiet.to': '08:00', services: []}`);
  set.length = 0;
  const from = {dataset: {key: 'quiet.from'}, type: 'time', value: '', hasAttribute: () => false};
  listeners.change({target: from});
  assert.strictEqual(from.value, '22:00');
  assert.strictEqual(set.length, 0);
  page('paintQuiet()');
  assert.strictEqual(element('quiet-same').hidden, true);
  listeners.change({target: {...from, value: '08:00'}});
  await new Promise(r => setTimeout(r, 0));
  assert.deepStrictEqual(set.map(v => ({...v})), [{'quiet.from': '08:00'}]);
  assert.strictEqual(element('quiet-same').hidden, false);
  listeners.change({target: {...from, value: '23:15'}});
  assert.strictEqual(element('quiet-same').hidden, true);
});
check('the page has a note element for equal quiet times, and every new string', () => {
  assert.ok(/id="quiet-same"[^>]*data-i18n="quietSame"/.test(html));
  for (const key of ['opt_quietSame', 'opt_ruleField', 'opt_serviceAccess']) {
    assert.ok(en[key]?.message, key);
  }
});

(async () => {
  for (const [name, fn] of checks) {
    await fn();
    n += 1;
    console.log('ok', name);
  }
  console.log(n, 'checks passed');
})().catch(e => {
  console.error(e);
  process.exit(1);
});
