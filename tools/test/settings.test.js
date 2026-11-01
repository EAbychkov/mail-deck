// The settings page's own logic (extension/data/settings/index.js) in node: what a backup may
// bring, where an account's labels go, which services keep their sites, the quiet hours'
// times, and the AI card: its engine, a provider's key, Chrome's access and the models. The page
// runs in a vm with a small document and chrome.*; nothing is drawn. The AI module
// (data/ai/ai.js, tested on its own) is replaced by a stub that writes down what it is asked.
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
      setAttribute() {}, removeAttribute() {}, focus() {}, add() {}, click() {},
      // what the page puts in an element, for the checks that look
      append(...kids) {
        this.kids = [...(this.kids || []), ...kids];
      },
      replaceChildren(...kids) {
        this.kids = kids;
      },
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
const forgotten = [];
const synced = [];
// the AI providers' sites: given only when a check gives them; every other site is given
const AI_SITES = ['https://api.openai.com/*', 'https://api.anthropic.com/*'];
const granted = new Set();
const requested = [];
let grant = true;
const store = {
  // the page's own start waits for this forever: the checks below call its parts one by one
  get: () => new Promise(() => {}),
  set: async values => {
    set.push(values);
    Object.assign(local, values);
  },
  remove: async keys => {
    for (const k of [keys].flat()) {
      forgotten.push(k);
      delete local[k];
    }
  }
};
const chrome = {
  i18n: {
    getMessage: (key, subs = []) => (en[key]?.message || '').replace(/\$(\d)/g, (_, i) => subs[i - 1] ?? ''),
    getUILanguage: () => 'en'
  },
  storage: {
    local: store,
    session: {get: async defaults => ({...defaults, ...session})},
    sync: {get: async () => ({}), set: async values => {
      synced.push(values);
    }, remove: async () => {}},
    onChanged: {addListener() {}}
  },
  permissions: {
    contains: async ({origins}) => origins.every(o => !AI_SITES.includes(o) || granted.has(o)),
    // written down as it is asked, before anything is awaited: that is what Chrome takes as the click's
    request: async ({origins}) => {
      requested.push(origins);
      if (grant) {
        origins.forEach(o => granted.add(o));
      }
      return grant;
    },
    remove: async ({origins}) => {
      removed.push(...origins);
      origins.forEach(o => granted.delete(o));
      return true;
    },
    onAdded: {addListener() {}},
    onRemoved: {addListener() {}}
  },
  commands: {getAll: () => Promise.resolve([])},
  runtime: {getManifest: () => ({version: '0'}), sendMessage: async () => null},
  tabs: {create() {}}
};

// the page's timers do not keep node waiting once the checks are done (the diagnostics' 8 s)
const later = (fn, ms, ...args) => {
  const id = setTimeout(fn, ms, ...args);
  id.unref?.();
  return id;
};
const ctx = {document, chrome, location: {hash: '', reload() {}}, addEventListener() {}, confirm: () => true,
  setTimeout: later, clearTimeout, URL, Blob, console};
ctx.self = ctx;
vm.createContext(ctx);
// the page's scripts in its order: the mail services first, then the page; the AI module's place
// is taken by the stub below
const html = fs.readFileSync(path.join(EXT, 'data/settings/index.html'), 'utf8');
for (const [, src] of html.matchAll(/<script src="([^"]+)"/g)) {
  const file = src.startsWith('/') ? path.join(EXT, src) : path.join(EXT, 'data/settings', src);
  if (file.endsWith(path.join('data', 'ai', 'ai.js'))) {
    continue;
  }
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, {filename: file});
}
// self.AI as data/ai/ai.js gives it, with answers a check sets: what is asked, in order
const asked = [];
const ai = {
  availability: 'available', state: null, checkError: null, modelsError: null,
  models: [
    {id: 'claude-opus-5-5', name: 'Claude Opus 5.5', recommended: true, tag: 'best', default: true},
    {id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', recommended: true, tag: 'fast'},
    {id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5'}
  ],
  progress: [],
  downloaded: null
};
ctx.AI = {
  ENGINES: ['off', 'builtin', 'openai', 'anthropic'],
  state: async p => {
    asked.push(['state', p.engine]);
    return ai.state || {ok: ai.availability === 'available', reason: ai.availability, lang: 'en'};
  },
  check: async (engine, key) => {
    asked.push(['check', engine, key]);
    if (ai.checkError) {
      throw ai.checkError;
    }
    return true;
  },
  models: async (engine, key) => {
    asked.push(['models', engine, key]);
    if (ai.modelsError) {
      throw ai.modelsError;
    }
    return ai.models.map(m => ({...m}));
  },
  builtin: {
    availability: async lang => {
      asked.push(['availability', lang]);
      return ai.availability;
    },
    download: onProgress => {
      asked.push(['download']);
      ai.progress.forEach(p => onProgress(p));
      return new Promise((resolve, reject) => ai.downloaded = {resolve, reject});
    }
  }
};
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
check('a backup keeps what the count, the repeat and the auto-advance may be, and nothing else', () => {
  const sanitize = page('sanitize');
  const good = {'badge.count': 'new', 'notify.repeat': 15, 'autoAdvance': true};
  assert.deepStrictEqual({...sanitize(good)}, good);
  assert.deepStrictEqual({...sanitize({'badge.count': 'some', 'notify.repeat': 7, 'autoAdvance': 'yes'})}, {});
  assert.deepStrictEqual({...sanitize({'badge.count': 1, 'notify.repeat': '5'})}, {});
  // what the page offers is what a backup may hold, its default among it
  for (const key of ['notify.repeat', 'badge.count']) {
    const select = new RegExp(`<select data-key="${key.replace('.', '\\.')}"[^>]*>([\\s\\S]*?)</select>`).exec(html);
    assert.ok(select, key);
    const numeric = /data-type="number"/.test(select[0]);
    const values = [...select[1].matchAll(/value="([^"]*)"/g)].map(m => numeric ? Number(m[1]) : m[1]);
    assert.ok(values.length > 1 && values.every(v => page('VALID')[key](v)), key);
    assert.ok(values.includes(page('DEFAULTS')[key]), key + ' offers its default');
  }
});
check('an inbox left out of the count stays out of it in a backup', () => {
  const out = page('sanitize')({accounts: {'a@gmail.com': {uncounted: true}, 'b@gmail.com': {uncounted: 'yes', quiet: true}}});
  assert.deepStrictEqual({...out.accounts['a@gmail.com']}, {ignored: false, quiet: false, uncounted: true});
  assert.deepStrictEqual({...out.accounts['b@gmail.com']}, {ignored: false, quiet: true});
});
check('an export holds the new settings, not the time the panel was last opened', async () => {
  Object.assign(local, {'badge.count': 'new', 'badge.seen': 123, 'notify.repeat': 30});
  const out = await page('collect(false)');
  assert.deepStrictEqual([out['badge.count'], out['notify.repeat'], out.autoAdvance], ['new', 30, false]);
  assert.strictEqual('badge.seen' in out, false);
});
check('the new settings default as the background does, and their rows and strings are there', () => {
  const defaults = page('DEFAULTS');
  assert.deepStrictEqual([defaults['badge.count'], defaults['notify.repeat'], defaults.autoAdvance], ['all', 0, false]);
  const background = fs.readFileSync(path.join(EXT, 'core/check.js'), 'utf8');
  assert.ok(background.includes(`'badge.count': 'all'`) && background.includes(`'notify.repeat': 0`));
  assert.ok(/data-key="autoAdvance"/.test(html) && /data-i18n="countHint"/.test(html));
  for (const key of ['opt_countChip', 'opt_countHint', 'opt_badgeCount', 'opt_badgeAll', 'opt_badgeNew', 'opt_badgeCountText',
    'opt_repeat', 'opt_repeatOff', 'opt_repeatText', 'opt_autoAdvance', 'opt_autoAdvanceText']) {
    assert.ok(en[key]?.message, key);
  }
  assert.ok(en.opt_formatText.message.includes('[account]'));
});

/* the AI card */
const msg = (key, ...subs) => chrome.i18n.getMessage(key, subs.map(String));
const tick = () => new Promise(r => setTimeout(r, 0));
const OPENAI_KEY = 'sk-proj-SECRET-openai-0123456789';
const ANTHROPIC_KEY = 'sk-ant-api03-SECRET-anthropic-0123456789';
// a fresh card for each check: the defaults, no key, no provider's site, the stub's answers
const freshAI = (values = {}) => {
  for (const k of Object.keys(local)) {
    delete local[k];
  }
  Object.assign(local, values);
  granted.clear();
  grant = true;
  for (const list of [set, removed, forgotten, synced, requested, asked]) {
    list.length = 0;
  }
  Object.assign(ai, {availability: 'available', state: null, checkError: null, modelsError: null, progress: [], downloaded: null});
  page(`prefs = {...DEFAULTS, ...${JSON.stringify(values)}}; aiKeys = {}; aiConnecting = false; aiDownload = null;
    for (const id of Object.keys(aiLists)) delete aiLists[id];
    for (const id of Object.keys(aiAccess)) delete aiAccess[id];
    clearTimeout(aiPoll);`);
  for (const id of ['ai-key', 'ai-error', 'ai-model', 'ai-model-note', 'ai-builtin-error', 'ai-builtin-lang']) {
    Object.assign(element(id), {value: '', textContent: '', hidden: false, kids: []});
  }
  element('ai-key').type = 'password';
  return Promise.all([page('readAIKeys()'), page('syncAIAccess()')]);
};
const has = (value, secret) => JSON.stringify(value).includes(secret);

check('the AI settings default as the module does; a backup keeps them and never a key', () => {
  const defaults = page('DEFAULTS');
  assert.deepStrictEqual(['ai.engine', 'ai.openai.model', 'ai.anthropic.model', 'ai.summary', 'ai.reply'].map(k => defaults[k]),
    ['off', '', '', 'click', true]);
  assert.ok(!Object.keys(defaults).some(k => k.endsWith('.key')), 'no key among the settings a backup is made of');
  const sanitize = page('sanitize');
  const good = {'ai.engine': 'anthropic', 'ai.anthropic.model': 'claude-opus-5-5', 'ai.openai.model': 'gpt-5.1-mini',
    'ai.summary': 'auto', 'ai.reply': false};
  assert.deepStrictEqual({...sanitize(good)}, good);
  assert.deepStrictEqual({...sanitize({'ai.engine': 'builtin', 'ai.summary': 'off', 'ai.openai.model': ''})},
    {'ai.engine': 'builtin', 'ai.summary': 'off', 'ai.openai.model': ''});
  const bad = {'ai.engine': 'gemini', 'ai.summary': 'always', 'ai.reply': 'yes', 'ai.openai.model': 'gpt 5',
    'ai.anthropic.model': 'c'.repeat(101), 'ai.openai.key': OPENAI_KEY, 'ai.anthropic.key': ANTHROPIC_KEY,
    'ai.replies': {x: {r: 1, w: 'asks', t: 1}}};
  assert.deepStrictEqual({...sanitize(bad)}, {});
  // what the page offers is what a backup may hold, its default among it
  const select = /<select data-key="ai\.summary"[^>]*>([\s\S]*?)<\/select>/.exec(html);
  const values = [...select[1].matchAll(/value="([^"]*)"/g)].map(m => m[1]);
  assert.deepStrictEqual(values, ['off', 'click', 'auto']);
  assert.ok(values.every(v => page('VALID')['ai.summary'](v)) && values.includes(defaults['ai.summary']));
  const engines = [...html.matchAll(/name="ai\.engine" value="([^"]+)"/g)].map(m => m[1]);
  assert.deepStrictEqual(engines, [...ctx.AI.ENGINES]);
});
check('a key is never in an export, in Chrome sync or in the diagnostics', async () => {
  await freshAI({'ai.engine': 'openai', 'ai.openai.model': 'gpt-5-mini', 'ai.openai.key': OPENAI_KEY,
    'ai.anthropic.key': ANTHROPIC_KEY, 'sync.settings': true});
  granted.add('https://api.openai.com/*');
  for (const files of [true, false]) {
    const out = await page(`collect(${files})`);
    assert.strictEqual(out['ai.engine'], 'openai');
    assert.strictEqual(out['ai.openai.model'], 'gpt-5-mini');
    assert.ok(!has(out, OPENAI_KEY) && !has(out, ANTHROPIC_KEY) && !Object.keys(out).some(k => k.endsWith('.key')));
  }
  // the copy in Chrome sync, made at once instead of 1.5 s later
  ctx.setTimeout = fn => fn();
  try {
    page('pushSync()');
    await tick();
    await tick();
  }
  finally {
    ctx.setTimeout = later;
  }
  assert.ok(synced.length > 0, 'a copy went to Chrome sync');
  assert.ok(synced.every(v => !has(v, OPENAI_KEY) && !has(v, ANTHROPIC_KEY)));
  assert.ok(synced.some(v => has(v, 'gpt-5-mini')), 'the model goes along');
  // the diagnostics ask the provider with the key and say how it went, without it
  const line = await page('aiDiag()');
  assert.deepStrictEqual([...line], ['ai', true, 'OpenAI · gpt-5-mini']);
  assert.ok(asked.some(([what, engine, key]) => what === 'check' && engine === 'openai' && key === OPENAI_KEY));
  ai.checkError = {code: 'auth'};
  const refused = await page('aiDiag()');
  assert.deepStrictEqual([...refused], ['ai', false, 'OpenAI: ' + msg('opt_aiErrAuth', 'OpenAI')]);
  granted.clear();
  assert.deepStrictEqual([...await page('aiDiag()')], ['ai', false, 'OpenAI: ' + msg('opt_aiDiagNoAccess', 'api.openai.com')]);
  delete local['ai.openai.key'];
  assert.deepStrictEqual([...await page('aiDiag()')], ['ai', false, 'OpenAI: ' + msg('opt_aiDiagNoKey')]);
  page(`prefs['ai.engine'] = 'off'`);
  assert.deepStrictEqual([...await page('aiDiag()')], ['ai', null, msg('opt_aiOff')]);
  // the line is one of the browser's
  assert.ok(/aiDiag\(\)\s*\]\);/.test(fs.readFileSync(path.join(EXT, 'data/settings/index.js'), 'utf8')));
});
check('the engine and what the AI does are saved as they change, and the keys load as stored', async () => {
  await freshAI({'ai.anthropic.key': ANTHROPIC_KEY});
  listeners.change({target: {name: 'ai.engine', value: 'anthropic', dataset: {}}});
  listeners.change({target: {dataset: {key: 'ai.summary'}, type: 'select-one', value: 'auto', hasAttribute: () => false}});
  listeners.change({target: {dataset: {key: 'ai.reply'}, type: 'checkbox', checked: false, hasAttribute: () => false}});
  // an engine the page does not offer is not saved
  listeners.change({target: {name: 'ai.engine', value: 'gemini', dataset: {}}});
  await tick();
  assert.deepStrictEqual(set.map(v => ({...v})), [{'ai.engine': 'anthropic'}, {'ai.summary': 'auto'}, {'ai.reply': false}]);
  // a key stored, its site not given: connected, with a word and a button to give it again
  await page('syncAIAccess()');
  page('paintCloud()');
  assert.strictEqual(element('ai-key-row').hidden, true);
  assert.strictEqual(element('ai-connected').hidden, false);
  assert.strictEqual(element('ai-connected-title').textContent, msg('opt_aiConnected', 'Anthropic'));
  assert.strictEqual(element('ai-access').hidden, false);
  assert.strictEqual(element('ai-access').textContent, msg('opt_aiNoAccess', 'api.anthropic.com'));
  assert.strictEqual(element('ai-allow').hidden, false);
  assert.strictEqual(element('ai-model-row').hidden, true);
  // no key: the field, its provider's key page and what a subscription does not give
  page(`prefs['ai.engine'] = 'openai'`);
  page('paintCloud()');
  assert.strictEqual(element('ai-key-row').hidden, false);
  assert.strictEqual(element('ai-connected').hidden, true);
  assert.strictEqual(element('ai-key-link').href, 'https://platform.openai.com/api-keys');
  assert.strictEqual(element('ai-key-plan').textContent, msg('opt_aiKeyText', 'ChatGPT Plus', 'OpenAI'));
  assert.strictEqual(element('ai-key-label').textContent, msg('opt_aiKey', 'OpenAI'));
  page(`prefs['ai.engine'] = 'anthropic'; aiKeys['ai.anthropic.key'] = ''`);
  page('paintCloud()');
  assert.strictEqual(element('ai-key-link').href, 'https://console.anthropic.com/settings/keys');
  assert.strictEqual(element('ai-key-plan').textContent, msg('opt_aiKeyText', 'Claude Pro', 'Anthropic'));
  // the field never shows a stored key
  assert.ok(!has(element('ai-key').value, ANTHROPIC_KEY));
  // the key field: a password, nothing filled in or checked by the browser
  assert.ok(/<input type="password" id="ai-key" autocomplete="off" spellcheck="false"/.test(html));
});
check('Connect asks Chrome for that provider\'s site from the click, then checks the key and lists its models', async () => {
  await freshAI({'ai.engine': 'anthropic'});
  element('ai-key').value = '  ' + ANTHROPIC_KEY + ' ';
  const done = element('ai-connect').onclick();
  // asked from the click itself, before anything was awaited
  assert.deepStrictEqual(requested.map(o => [...o]), [['https://api.anthropic.com/*']]);
  assert.strictEqual(asked.length, 0, 'the key is checked only after Chrome gave the site');
  assert.strictEqual(await done, true);
  assert.deepStrictEqual(asked.map(a => a.join(' ')), [`check anthropic ${ANTHROPIC_KEY}`, `models anthropic ${ANTHROPIC_KEY}`]);
  assert.strictEqual(local['ai.anthropic.key'], ANTHROPIC_KEY);
  assert.strictEqual(local['ai.anthropic.model'], 'claude-opus-5-5', 'the model the module marks');
  assert.strictEqual(element('ai-key').value, '', 'the field forgets the key');
  assert.strictEqual(element('ai-error').hidden, true);
  assert.strictEqual(element('ai-connected').hidden, false);
  assert.strictEqual(element('ai-model-row').hidden, false);
  // the models: what the account had picked first, recommended ones in a group, with what for
  const groups = element('ai-model').kids;
  assert.strictEqual(groups[0].label, msg('opt_aiRecommended'));
  assert.deepStrictEqual(groups[0].kids.map(o => o.textContent),
    ['Claude Opus 5.5 · ' + msg('opt_aiBest'), 'Claude Haiku 5.5 · ' + msg('opt_aiFast')]);
  assert.strictEqual(groups[1].label, msg('opt_aiOtherModels'));
  assert.deepStrictEqual(groups[1].kids.map(o => o.value), ['claude-sonnet-5-5']);
  // a model picked before stays picked on a new key
  await freshAI({'ai.engine': 'openai', 'ai.openai.model': 'gpt-4.1'});
  ai.models = [{id: 'gpt-5', name: 'gpt-5', recommended: true, tag: 'best'}, {id: 'gpt-5-mini', name: 'gpt-5-mini', recommended: true, tag: 'fast', default: true}, {id: 'gpt-4.1', name: 'gpt-4.1'}];
  element('ai-key').value = OPENAI_KEY;
  assert.strictEqual(await element('ai-connect').onclick(), true);
  assert.deepStrictEqual(requested.map(o => [...o]), [['https://api.openai.com/*']]);
  assert.strictEqual(local['ai.openai.model'], 'gpt-4.1');
  // Enter in the field connects as well
  await freshAI({'ai.engine': 'openai'});
  element('ai-key').value = OPENAI_KEY;
  let prevented = false;
  element('ai-key').onkeydown({key: 'Enter', preventDefault: () => prevented = true});
  assert.ok(prevented && requested.length === 1);
  // that connect ends before the next check starts
  await new Promise(r => setTimeout(r, 20));
  assert.strictEqual(local['ai.openai.key'], OPENAI_KEY);
});
check('Connect says precisely why a key did not connect, and keeps nothing of it', async () => {
  // nothing pasted, or another provider's key: said at once, Chrome is not asked
  await freshAI({'ai.engine': 'openai'});
  assert.strictEqual(await element('ai-connect').onclick(), false);
  assert.strictEqual(element('ai-error').textContent, msg('opt_aiKeyEmpty'));
  assert.strictEqual(element('ai-error').hidden, false);
  element('ai-key').value = ANTHROPIC_KEY;
  assert.strictEqual(await element('ai-connect').onclick(), false);
  assert.strictEqual(element('ai-error').textContent, msg('opt_aiKeyOther', 'Anthropic', 'OpenAI'));
  assert.strictEqual(requested.length, 0);
  // typing clears the word
  element('ai-key').oninput();
  assert.strictEqual(element('ai-error').hidden, true);
  // Chrome's access refused: no key check, nothing kept
  element('ai-key').value = OPENAI_KEY;
  grant = false;
  assert.strictEqual(await element('ai-connect').onclick(), false);
  assert.strictEqual(element('ai-error').textContent, msg('opt_aiErrAccess', 'api.openai.com'));
  assert.strictEqual(asked.length, 0);
  assert.ok(!('ai.openai.key' in local));
  // the provider refuses the key: said so, and the site given for it goes back to Chrome
  grant = true;
  ai.checkError = {code: 'auth'};
  assert.strictEqual(await element('ai-connect').onclick(), false);
  assert.strictEqual(element('ai-error').textContent, msg('opt_aiErrAuth', 'OpenAI'));
  assert.ok(!('ai.openai.key' in local) && !granted.has('https://api.openai.com/*'));
  assert.deepStrictEqual(removed, ['https://api.openai.com/*']);
  // the module's own words where they suit this page
  ai.checkError = null;
  ai.modelsError = {code: 'network'};
  assert.strictEqual(await element('ai-connect').onclick(), false);
  assert.strictEqual(element('ai-error').textContent, msg('ai_err_network'));
  // a key with no model Mail Deck can use
  ai.modelsError = null;
  const models = ai.models;
  ai.models = [];
  assert.strictEqual(await element('ai-connect').onclick(), false);
  assert.strictEqual(element('ai-error').textContent, msg('opt_aiNoModels'));
  ai.models = models;
  assert.ok(!set.some(v => 'ai.openai.key' in v), 'no key that failed was ever stored');
});
check('every AIError code reads as what to do', () => {
  const text = page('aiErrorText');
  const expect = {
    'auth': msg('opt_aiErrAuth', 'OpenAI'),
    'no-access': msg('opt_aiErrAccess', 'api.openai.com'),
    'model': msg('opt_aiNoModels'),
    'no-models': msg('opt_aiNoModels'),
    'quota': msg('ai_err_quota'),
    'rate': msg('ai_err_rate'),
    'network': msg('ai_err_network'),
    'server': msg('ai_err_server'),
    'unavailable': msg('ai_err_unavailable'),
    'too-long': msg('ai_err_too_long'),
    'refusal': msg('ai_err_refusal'),
    'bad-output': msg('ai_err_bad_output'),
    'aborted': '',
    'something-new': msg('opt_aiErrOther')
  };
  for (const [code, want] of Object.entries(expect)) {
    assert.strictEqual(text({code}, 'openai'), want, code);
    assert.ok(code === 'aborted' || want, code + ' has words');
  }
  assert.strictEqual(text(new TypeError('Failed to fetch'), 'openai'), msg('opt_aiErrOther'));
  assert.strictEqual(text({code: 'auth'}, 'anthropic'), msg('opt_aiErrAuth', 'Anthropic'));
});
check('Disconnect forgets the key and the model and gives the provider\'s site back', async () => {
  await freshAI({'ai.engine': 'anthropic', 'ai.anthropic.key': ANTHROPIC_KEY, 'ai.anthropic.model': 'claude-haiku-5-5',
    'ai.openai.key': OPENAI_KEY});
  granted.add('https://api.anthropic.com/*');
  granted.add('https://api.openai.com/*');
  await page('syncAIAccess()');
  await element('ai-disconnect').onclick();
  assert.ok(!('ai.anthropic.key' in local) && !('ai.anthropic.model' in local));
  assert.strictEqual(local['ai.openai.key'], OPENAI_KEY, 'the other provider keeps its key');
  assert.deepStrictEqual(removed, ['https://api.anthropic.com/*']);
  assert.ok(granted.has('https://api.openai.com/*'));
  assert.strictEqual(element('ai-key-row').hidden, false);
  assert.strictEqual(element('ai-connected').hidden, true);
});
check('a reset forgets both keys and gives back both providers\' sites', async () => {
  await freshAI({'ai.engine': 'openai', 'ai.openai.key': OPENAI_KEY, 'ai.anthropic.key': ANTHROPIC_KEY,
    'ai.openai.model': 'gpt-5-mini', 'ai.replies': {x: {r: 1, w: 'asks', t: 1}}});
  AI_SITES.forEach(o => granted.add(o));
  await element('reset').onclick();
  assert.ok(!('ai.openai.key' in local) && !('ai.anthropic.key' in local) && !('ai.replies' in local));
  assert.strictEqual(local['ai.engine'], 'off');
  assert.strictEqual(local['ai.openai.model'], '');
  assert.ok(AI_SITES.every(o => removed.includes(o) && !granted.has(o)));
  assert.ok(en.opt_resetConfirm.message.includes('AI'));
});
check('the built-in model: a line for each state Chrome tells, and the download from the click', async () => {
  const views = {
    'available': ['opt_aiReady', 'opt_aiReadyText', 'ok', false, false],
    'downloadable': ['opt_aiNeedsDownload', 'opt_aiNeedsDownloadText', 'wait', true, false],
    'downloading': ['opt_aiDownloading', '', 'wait', false, true],
    'unavailable': ['opt_aiUnavailable', 'opt_aiUnavailableText', 'bad', false, false],
    'old-chrome': ['opt_aiOldChrome', 'opt_aiOldChromeText', 'bad', false, false]
  };
  for (const [status, [title, text, state, download, meter]] of Object.entries(views)) {
    await freshAI({'ai.engine': 'builtin'});
    ai.availability = status;
    ai.state = status === 'old-chrome' ? {ok: false, reason: 'old-chrome', lang: 'en'} : null;
    await page('paintBuiltin()');
    page('clearTimeout(aiPoll)');
    assert.strictEqual(element('ai-builtin-title').textContent, msg(title), status);
    assert.strictEqual(element('ai-builtin-title').dataset.state, state, status);
    assert.strictEqual(element('ai-builtin-text').textContent, text && msg(text), status);
    assert.strictEqual(element('ai-builtin-text').hidden, !text, status);
    assert.strictEqual(element('ai-download').hidden, !download, status);
    assert.strictEqual(element('ai-meter').hidden, !meter, status);
    assert.strictEqual(element('ai-builtin-lang').hidden, true, status + ': the UI language is spoken');
  }
  // a UI language the model does not speak: it answers in English, and the card says so
  await freshAI({'ai.engine': 'builtin'});
  const ui = chrome.i18n.getUILanguage;
  chrome.i18n.getUILanguage = () => 'ru';
  try {
    ai.state = {ok: true, lang: 'en', note: 'x'};
    await page('paintBuiltin()');
    assert.strictEqual(element('ai-builtin-lang').hidden, false);
    assert.strictEqual(element('ai-builtin-lang').textContent, msg('opt_aiEnglish', new Intl.DisplayNames(['ru'], {type: 'language'}).of('ru')));
    assert.deepStrictEqual(asked.filter(a => a[0] === 'availability'), [['availability', 'en']], 'asked for the language it answers in');
  }
  finally {
    chrome.i18n.getUILanguage = ui;
  }
  // Download: called from the click itself; the meter follows Chrome's progress; ready at its end
  await freshAI({'ai.engine': 'builtin'});
  ai.availability = 'downloadable';
  ai.progress = [0.25];
  element('ai-download').onclick();
  assert.deepStrictEqual(asked.slice(-1), [['download']], 'download() is the click\'s first call');
  assert.strictEqual(element('ai-meter').hidden, false);
  assert.strictEqual(element('ai-progress').value, 25);
  assert.strictEqual(element('ai-percent').textContent, '25%');
  assert.strictEqual(element('ai-download').hidden, true);
  // a second click while it downloads asks for nothing more
  element('ai-download').onclick();
  assert.strictEqual(asked.filter(a => a[0] === 'download').length, 1);
  ai.availability = 'available';
  ai.downloaded.resolve();
  await tick();
  await tick();
  await tick();
  assert.strictEqual(element('ai-builtin-title').textContent, msg('opt_aiReady'));
  assert.strictEqual(element('toast').textContent, msg('opt_aiReady'));
  // a download that fails says why
  await freshAI({'ai.engine': 'builtin'});
  ai.availability = 'downloadable';
  element('ai-download').onclick();
  ai.downloaded.reject({code: 'unavailable'});
  await tick();
  await tick();
  assert.strictEqual(element('ai-builtin-error').hidden, false);
  assert.strictEqual(element('ai-builtin-error').textContent, msg('ai_err_unavailable'));
});
check('a model the account no longer has stays shown, with a word to pick another', async () => {
  await freshAI({'ai.engine': 'openai', 'ai.openai.key': OPENAI_KEY, 'ai.openai.model': 'gpt-4-old'});
  granted.add('https://api.openai.com/*');
  ai.models = [{id: 'gpt-5-mini', name: 'gpt-5-mini', recommended: true, tag: 'fast', default: true}, {id: 'gpt-4.1', name: 'gpt-4.1'}];
  await page('syncAIAccess()');
  page('paintCloud()');
  // what is stored shows at once, the list follows
  assert.deepStrictEqual(element('ai-model').kids.map(o => o.value), ['gpt-4-old']);
  await tick();
  await tick();
  const kids = element('ai-model').kids;
  assert.strictEqual(kids[0].value, 'gpt-4-old');
  assert.strictEqual(kids[1].label, msg('opt_aiRecommended'));
  assert.strictEqual(element('ai-model-note').hidden, false);
  assert.strictEqual(element('ai-model-note').textContent, msg('opt_aiModelGone', 'gpt-4-old'));
  // picking one saves it for that provider, and the word goes
  element('ai-model').value = 'gpt-5-mini';
  element('ai-model').onchange();
  await tick();
  await tick();
  assert.strictEqual(local['ai.openai.model'], 'gpt-5-mini');
  assert.strictEqual(element('ai-model-note').hidden, true);
  // a key revoked meanwhile: the list does not come, and the row says why
  await freshAI({'ai.engine': 'openai', 'ai.openai.key': OPENAI_KEY, 'ai.openai.model': 'gpt-5-mini'});
  granted.add('https://api.openai.com/*');
  ai.modelsError = {code: 'auth'};
  await page('syncAIAccess()');
  page('paintCloud()');
  await tick();
  await tick();
  assert.strictEqual(element('ai-model-note').textContent, msg('opt_aiErrAuth', 'OpenAI'));
  assert.strictEqual(asked.filter(a => a[0] === 'models').length, 1, 'asked once, not again on every paint');
  page('paintCloud()');
  await tick();
  assert.strictEqual(asked.filter(a => a[0] === 'models').length, 1);
});
check('the card follows what changes elsewhere: another tab, chrome://extensions', async () => {
  await freshAI({});
  page('followAI')({'ai.engine': {newValue: 'openai'}, 'ai.summary': {newValue: 'off'}});
  assert.strictEqual(page(`prefs['ai.engine']`), 'openai');
  assert.strictEqual(page(`prefs['ai.summary']`), 'off');
  page('followAI')({'ai.openai.key': {newValue: OPENAI_KEY}});
  assert.strictEqual(page(`aiKeyOf('openai')`), OPENAI_KEY);
  assert.strictEqual(element('ai-connected').hidden, false);
  // the site taken back on chrome://extensions: the card says so in place
  await page('syncAIAccess()');
  page('paintCloud()');
  assert.strictEqual(element('ai-access').hidden, false);
  assert.strictEqual(element('ai-model-row').hidden, true);
  // given again from the card's button
  await element('ai-allow').onclick();
  assert.deepStrictEqual(requested.map(o => [...o]), [['https://api.openai.com/*']]);
  assert.strictEqual(element('ai-access').hidden, true);
  assert.strictEqual(element('ai-model-row').hidden, false);
  // a key removed in another tab
  page('followAI')({'ai.openai.key': {oldValue: OPENAI_KEY}});
  assert.strictEqual(element('ai-key-row').hidden, false);
  // the page follows storage and Chrome's access in its start
  const code = fs.readFileSync(path.join(EXT, 'data/settings/index.js'), 'utf8');
  assert.ok(/followAI\(ps\)/.test(code) && /onRemoved\?\.addListener\(followAccess\)/.test(code));
});
check('the AI card has its strings and loads the module before the page', () => {
  assert.ok(html.indexOf('<script src="../ai/ai.js">') > 0 && html.indexOf('<script src="../ai/ai.js">') < html.indexOf('<script src="index.js">'));
  for (const [, key] of html.matchAll(/data-i18n(?:-label)?="(ai\w*)"/g)) {
    assert.ok(en['opt_' + key]?.message, key);
  }
  for (const key of ['opt_aiPrivacy', 'opt_aiPrivacyLocal', 'opt_aiKeyText', 'opt_aiGetKey', 'opt_aiConnect', 'opt_aiDisconnect']) {
    assert.ok(en[key]?.message, key);
  }
  // the subscription note and the privacy note say what the spec asks
  assert.ok(/does not include API access/.test(en.opt_aiKeyText.message));
  assert.ok(/straight to \$1, with your key\. Mail Deck has no servers\./.test(en.opt_aiPrivacy.message));
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  assert.ok(manifest.permissions.includes('activeTab'));
  assert.ok(AI_SITES.every(o => manifest.optional_host_permissions.includes(o) && !manifest.host_permissions.includes(o)));
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
