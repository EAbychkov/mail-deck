// The Mail.ru service (core/services/mailru.js) against a stubbed mail.ru: the answers below
// have the shapes Pulsar and 3MR mailru-notifier parse.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const FILE = path.join(__dirname, '../../../extension/core/services/mailru.js');
const CODE = fs.readFileSync(FILE, 'utf8');

const json = (o, status = 200) => Response.json(o, {status});
const html = (text = '<html>login</html>') => new Response(text, {headers: {'content-type': 'text/html'}});

// chrome.storage.session in memory
const memory = (init = {}) => {
  const data = structuredClone(init);
  return {
    data,
    async get(keys) {
      const list = keys === null || keys === undefined ? Object.keys(data) : typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
      return Object.fromEntries(list.filter(k => k in data).map(k => [k, structuredClone(data[k])]));
    },
    async set(o) {
      Object.assign(data, structuredClone(o));
    }
  };
};

/*
 * A fresh copy of the service with its own mail.ru: routes are [method, url prefix, reply];
 * reply(request, url) returns a Response, a plain object (sent as JSON), or throws.
 */
const load = (routes, session = {}) => {
  const calls = [];
  const storage = memory(session);
  const ctx = {
    URL, URLSearchParams, Response, AbortSignal, AbortController, console,
    chrome: {storage: {session: storage}},
    async fetch(url, init = {}) {
      const req = {method: init.method || 'GET', url: String(url), body: init.body, headers: init.headers || {}, credentials: init.credentials, signal: init.signal};
      calls.push(req);
      if (init.signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }
      const route = routes.find(([method, prefix]) => req.method === method && req.url.startsWith(prefix));
      if (!route) {
        throw Error('unrouted ' + req.method + ' ' + req.url);
      }
      const r = await route[2](req, new URL(req.url));
      return r instanceof Response ? r : json(r);
    }
  };
  ctx.self = ctx;
  const before = Object.keys(ctx);
  vm.runInNewContext(CODE, ctx);
  return {service: ctx.MailServices.mailru, calls, storage, ctx, before};
};

const NAVI = 'https://portal.mail.ru/NaviData';
const SHORT = 'https://e.mail.ru/api/v1/user/short';
const STATUS = 'https://e.mail.ru/api/v1/messages/status';
const MESSAGE = 'https://e.mail.ru/api/v1/messages/message';
const MARKS = 'https://e.mail.ru/api/v1/threads/marks';
const MOVE = 'https://e.mail.ru/api/v1/threads/move';

const navi = (email, list) => ({status: 'ok', data: {email, list, mail_cnt: 3}});
const msg = (id, date, extra = {}) => ({
  id,
  folder: '0',
  subject: ` s${id} `,
  snippet: ' Привет ',
  date,
  flags: {unread: true},
  correspondents: {from: [{name: 'Анна', email: 'Anna@Example.com'}]},
  ...extra
});
const status = (messages, unread) => ({
  status: 200,
  body: {messages, folders: [{id: '0', messages_unread: unread}, {id: '950', messages_unread: 3}]}
});
// a token per mailbox: t-<name>
const short = (req, url) => ({status: 200, body: {token: 't-' + url.searchParams.get('email').split('@')[0]}});
// the service's values come from its own realm: compare them as plain JSON
const plain = x => JSON.parse(JSON.stringify(x));
const params = req => Object.fromEntries(new URL(req.url).searchParams);
const form = req => Object.fromEntries(new URLSearchParams(req.body));

const MAILBOXES = {
  'ann@mail.ru': status([msg('101', 1791700000), msg('103', 1791733578), msg('102', 1791710000), msg('104', 1791720000, {flags: {unread: false}})], 7),
  'bob@bk.ru': status([msg('201', 1791600000, {subject: '', snippet: undefined, correspondents: {}})], undefined)
};
const signedIn = (extra = []) => [
  ...extra,
  ['GET', NAVI, () => navi('Ann@mail.ru', ['ann@mail.ru', 'Bob@bk.ru'])],
  ['GET', SHORT, short],
  ['GET', STATUS, req => MAILBOXES[params(req).email]]
];

const tests = [];
const check = (name, fn) => tests.push([name, fn]);
const signal = () => new AbortController().signal;

check('static fields', () => {
  const {service, ctx, before} = load([]);
  assert.strictEqual(service.id, 'mailru');
  assert.strictEqual(service.name, 'Mail.ru');
  assert.deepStrictEqual([...service.origins], ['https://portal.mail.ru/*', 'https://e.mail.ru/*']);
  assert.deepStrictEqual([...service.hosts], ['https://e.mail.ru/']);
  assert.strictEqual(service.signIn, 'https://account.mail.ru/login');
  assert.strictEqual(service.compose(), 'https://e.mail.ru/compose/');
  assert.strictEqual(service.compose('a@b.c', 'Re: x'), 'https://e.mail.ru/compose/');
  assert.deepStrictEqual({...service.can}, {archive: false, spam: true, body: true});
  assert.deepStrictEqual(JSON.parse(JSON.stringify(service.rewrite)), [{urlFilter: '||e.mail.ru/api/', origin: 'https://e.mail.ru'}]);
  // nothing leaks into the shared scope but the registry
  assert.deepStrictEqual(Object.keys(ctx).filter(k => !before.includes(k)), ['MailServices']);
});

check('collect: mailboxes, entries newest first, counts, fields', async () => {
  const {service, calls} = load(signedIn());
  const s = signal();
  const boxes = await service.collect({signal: s});
  assert.strictEqual(boxes.length, 2);
  const [ann, bob] = boxes;
  assert.strictEqual(ann.email, 'ann@mail.ru');
  assert.strictEqual(ann.inbox, 'https://e.mail.ru/inbox/?x-email=ann%40mail.ru');
  assert.strictEqual(ann.unread, 7);
  assert.deepStrictEqual(plain(ann.entries.map(e => e.id)), ['mailru:103', 'mailru:102', 'mailru:101']);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ann.entries[0])), {
    id: 'mailru:103',
    link: 'https://e.mail.ru/inbox/0:103:0/?x-email=ann%40mail.ru',
    ref: {id: '103', folder: '0'},
    title: 's103',
    summary: 'Привет',
    modified: new Date(1791733578000).toISOString(),
    author_name: 'Анна',
    author_email: 'anna@example.com'
  });
  // no counter: the entries count; missing fields stay empty
  assert.strictEqual(bob.email, 'bob@bk.ru');
  assert.strictEqual(bob.unread, 1);
  assert.deepStrictEqual([bob.entries[0].title, bob.entries[0].summary, bob.entries[0].author_name, bob.entries[0].author_email], ['', '', '', '']);
  const all = boxes.flatMap(b => b.entries);
  assert.strictEqual(new Set(all.map(e => e.id)).size, all.length);
  assert.strictEqual(new Set(all.map(e => e.link)).size, all.length);
  assert.strictEqual(new Set(boxes.map(b => b.inbox)).size, boxes.length);
  assert(all.every(e => service.hosts.some(h => e.link.startsWith(h))));
  // the requests: NaviData, a token and the unread inbox per mailbox, all with the session and the signal
  assert.strictEqual(calls.length, 5);
  assert(calls.every(c => c.credentials === 'include' && c.signal === s && c.method === 'GET'));
  assert(calls.every(c => service.origins.some(o => c.url.startsWith(o.replace('*', '')))));
  assert.strictEqual(calls[0].url, 'https://portal.mail.ru/NaviData?mac=1');
  assert.deepStrictEqual(calls.filter(c => c.url.startsWith(SHORT)).map(params), [
    {email: 'ann@mail.ru', htmlencoded: 'false'},
    {email: 'bob@bk.ru', htmlencoded: 'false'}
  ]);
  assert.deepStrictEqual(params(calls.find(c => c.url.startsWith(STATUS))), {
    folder: '0', limit: '20', offset: '0', filters: '{"unread":true}', email: 'ann@mail.ru', token: 't-ann', htmlencoded: 'false'
  });
});

check('collect: tokens are kept for the session and used again', async () => {
  const {service, calls, storage} = load(signedIn());
  await service.collect({signal: signal()});
  assert.deepStrictEqual(storage.data['service.mailru'], {tokens: {'ann@mail.ru': 't-ann', 'bob@bk.ru': 't-bob'}});
  calls.length = 0;
  await service.collect({signal: signal()});
  assert.deepStrictEqual(calls.map(c => c.url.split('?')[0]), [NAVI, STATUS, STATUS]);
});

check('collect: at most 20 entries, the counter may exceed them', async () => {
  const many = Array.from({length: 25}, (_, i) => msg(String(i + 1), 1791700000 + i));
  const {service} = load([
    ['GET', NAVI, () => navi('ann@mail.ru', ['ann@mail.ru'])],
    ['GET', SHORT, short],
    ['GET', STATUS, () => status(many, 30)]
  ]);
  const [ann] = await service.collect({signal: signal()});
  assert.strictEqual(ann.entries.length, 20);
  assert.strictEqual(ann.entries[0].id, 'mailru:25');
  assert.strictEqual(ann.unread, 30);
});

check('collect: NaviData?ldata=1 shape (data.ldata keys) is read too', async () => {
  const {service} = load([
    ['GET', NAVI, () => ({status: 'ok', data: {email: 'b@mail.ru', ldata: {'a@mail.ru': {}, 'b@mail.ru': {}}}})],
    ['GET', SHORT, short],
    ['GET', STATUS, () => status([], 0)]
  ]);
  assert.deepStrictEqual(plain((await service.collect({signal: signal()})).map(b => b.email)), ['b@mail.ru', 'a@mail.ru']);
});

check('collect: signed out -> []', async () => {
  for (const reply of [
    () => ({status: 'noauth', data: {action: 'list', list: []}}),
    () => json({}, 401),
    () => ({status: 'ok', data: {list: []}}),
    () => {
      const r = html();
      Object.defineProperties(r, {redirected: {value: true}, url: {value: 'https://account.mail.ru/login?page=x'}});
      return r;
    }
  ]) {
    const {service, calls} = load([['GET', NAVI, reply]]);
    assert.deepStrictEqual(plain(await service.collect({signal: signal()})), []);
    assert.strictEqual(calls.length, 1);
  }
});

check('collect: a mailbox the session lost is left out', async () => {
  const {service, calls} = load(signedIn([
    ['GET', SHORT + '?email=bob', () => ({status: 403, body: 'nosdc'})]
  ]));
  const boxes = await service.collect({signal: signal()});
  assert.deepStrictEqual(plain(boxes.map(b => b.email)), ['ann@mail.ru']);
  assert.strictEqual(calls.filter(c => c.url.startsWith(STATUS)).length, 1);
});

check('collect: an error status where the token should be throws, the mailbox is not taken for signed out', async () => {
  for (const code of [500, 429]) {
    const {service} = load(signedIn([['GET', SHORT + '?email=bob', () => ({status: code, body: 'error'})]]));
    await assert.rejects(service.collect({signal: signal()}), new RegExp('user/short: ' + code));
  }
  // an answer without a token, or noauth, still means the session lost the mailbox
  for (const reply of [() => ({status: 200, body: {}}), () => ({status: 'noauth'})]) {
    const {service} = load(signedIn([['GET', SHORT + '?email=bob', reply]]));
    assert.deepStrictEqual(plain((await service.collect({signal: signal()})).map(b => b.email)), ['ann@mail.ru']);
  }
});

check('collect: a stale token is replaced once', async () => {
  const seen = [];
  const {service, calls, storage} = load([
    ['GET', NAVI, () => navi('ann@mail.ru', ['ann@mail.ru'])],
    ['GET', SHORT, () => ({status: 200, body: {token: 'new'}})],
    ['GET', STATUS, req => {
      seen.push(params(req).token);
      return params(req).token === 'new' ? status([msg('1', 1791700000)], 1) : {status: 403, body: 'invalid token'};
    }]
  ], {'service.mailru': {tokens: {'ann@mail.ru': 'old'}}});
  const [ann] = await service.collect({signal: signal()});
  assert.strictEqual(ann.entries.length, 1);
  assert.deepStrictEqual(seen, ['old', 'new']);
  assert.strictEqual(calls.filter(c => c.url.startsWith(SHORT)).length, 1);
  assert.deepStrictEqual(storage.data['service.mailru'].tokens, {'ann@mail.ru': 'new'});
});

check('collect: a new token refused as well throws, no loop', async () => {
  const {service, calls} = load([
    ['GET', NAVI, () => navi('ann@mail.ru', ['ann@mail.ru'])],
    ['GET', SHORT, () => ({status: 200, body: {token: 'new'}})],
    ['GET', STATUS, () => json({status: 403}, 403)]
  ], {'service.mailru': {tokens: {'ann@mail.ru': 'old'}}});
  await assert.rejects(service.collect({signal: signal()}), /messages\/status: 403/);
  assert.strictEqual(calls.filter(c => c.url.startsWith(STATUS)).length, 2);
  assert.strictEqual(calls.filter(c => c.url.startsWith(SHORT)).length, 1);
});

check('collect: a token fetched just now and refused is not fetched again', async () => {
  const {service, calls} = load([
    ['GET', NAVI, () => navi('ann@mail.ru', ['ann@mail.ru'])],
    ['GET', SHORT, short],
    ['GET', STATUS, () => ({status: 403})]
  ]);
  await assert.rejects(service.collect({signal: signal()}), /messages\/status: 403/);
  assert.deepStrictEqual(calls.map(c => c.url.split('?')[0]), [NAVI, SHORT, STATUS]);
});

check('collect: a network failure or an unreadable answer throws', async () => {
  const offline = load([['GET', NAVI, () => {
    throw new TypeError('Failed to fetch');
  }]]);
  await assert.rejects(offline.service.collect({signal: signal()}), /Failed to fetch/);
  await assert.rejects(load([['GET', NAVI, () => html('<html>oops</html>')]]).service.collect({signal: signal()}), /NaviData: not JSON/);
  await assert.rejects(load([['GET', NAVI, () => ({status: 'error'})]]).service.collect({signal: signal()}), /NaviData: error/);
  await assert.rejects(load(signedIn([['GET', STATUS, () => json({status: 500}, 500)]])).service.collect({signal: signal()}), /messages\/status: 500/);
  await assert.rejects(load(signedIn([['GET', SHORT, () => html()]])).service.collect({signal: signal()}), /user\/short: not JSON/);
});

check('collect: an aborted signal stops it', async () => {
  const c = new AbortController();
  c.abort();
  const {service, calls} = load(signedIn());
  await assert.rejects(service.collect({signal: c.signal}), {name: 'AbortError'});
  assert.strictEqual(calls.length, 1);
});

const TOKENS = {'service.mailru': {tokens: {'ann@mail.ru': 't-ann'}}};
const REFS = [{id: '101', folder: '0'}, {id: '102', folder: '0'}];
const posted = (calls, url) => calls.filter(c => c.method === 'POST' && c.url === url);
const HEADERS = {'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json, text/plain, */*'};

check('action rd: one threads/marks for the batch', async () => {
  const {service, calls} = load([['POST', MARKS, () => ({status: 200})]], TOKENS);
  assert.strictEqual(await service.action({cmd: 'rd', email: 'ann@mail.ru', refs: REFS, prefs: {}, signal: signal()}), true);
  const [req, ...more] = posted(calls, MARKS);
  assert.strictEqual(more.length, 0);
  assert.strictEqual(calls.length, 1);
  assert.deepStrictEqual({...req.headers}, HEADERS);
  assert.strictEqual(req.credentials, 'include');
  const f = form(req);
  assert.deepStrictEqual(Object.keys(f), ['marks', 'message_id_last', 'email', 'htmlencoded', 'token']);
  assert.deepStrictEqual(JSON.parse(f.marks), [{name: 'unread', unset: ['0:101:0', '0:102:0'], folder: 0}]);
  assert.deepStrictEqual(JSON.parse(f.message_id_last), {'0:101:0': '101', '0:102:0': '102'});
  assert.deepStrictEqual([f.email, f.htmlencoded, f.token], ['ann@mail.ru', 'false', 't-ann']);
});

for (const [cmd, folder] of [['tr', '500002'], ['sp', '950']]) {
  check(`action ${cmd}: one threads/move to ${folder}`, async () => {
    const {service, calls} = load([['POST', MOVE, () => ({status: 200})]], TOKENS);
    assert.strictEqual(await service.action({cmd, email: 'ann@mail.ru', refs: REFS, prefs: {}, signal: signal()}), true);
    assert.strictEqual(calls.length, 1);
    const [req] = posted(calls, MOVE);
    assert.deepStrictEqual({...req.headers}, HEADERS);
    const f = form(req);
    assert.deepStrictEqual(Object.keys(f), ['ids', 'msg_ids', 'folder', 'message_id_last', 'email', 'htmlencoded', 'token']);
    assert.deepStrictEqual(JSON.parse(f.ids), ['0:101:0', '0:102:0']);
    assert.deepStrictEqual(JSON.parse(f.msg_ids), [{id: '0:101:0', folder: '0'}, {id: '0:102:0', folder: '0'}]);
    assert.strictEqual(f.folder, folder);
    assert.deepStrictEqual(JSON.parse(f.message_id_last), {'0:101:0': '101', '0:102:0': '102'});
    assert.deepStrictEqual([f.email, f.htmlencoded, f.token], ['ann@mail.ru', 'false', 't-ann']);
  });
}

check('action: a refused or unreadable answer throws, without a retry', async () => {
  for (const [cmd, url] of [['rd', MARKS], ['tr', MOVE], ['sp', MOVE]]) {
    for (const reply of [() => ({status: 500, body: 'error'}), () => html('<html></html>'), () => json({}, 502)]) {
      const {service, calls} = load([['POST', url, reply]], TOKENS);
      await assert.rejects(service.action({cmd, email: 'ann@mail.ru', refs: REFS, prefs: {}, signal: signal()}), /threads\/(marks|move): /);
      assert.strictEqual(calls.length, 1);
    }
    const offline = load([['POST', url, () => {
      throw new TypeError('Failed to fetch');
    }]], TOKENS);
    await assert.rejects(offline.service.action({cmd, email: 'ann@mail.ru', refs: REFS, prefs: {}, signal: signal()}), /Failed to fetch/);
    assert.strictEqual(offline.calls.length, 1);
  }
});

check('action: a stale token is replaced and the write sent once more', async () => {
  const {service, calls} = load([
    ['GET', SHORT, () => ({status: 200, body: {token: 'new'}})],
    ['POST', MARKS, req => form(req).token === 'new' ? {status: 200} : {status: 403}]
  ], TOKENS);
  assert.strictEqual(await service.action({cmd: 'rd', email: 'ann@mail.ru', refs: REFS, prefs: {}, signal: signal()}), true);
  assert.deepStrictEqual(calls.map(c => c.method + ' ' + c.url.split('?')[0]), ['POST ' + MARKS, 'GET ' + SHORT, 'POST ' + MARKS]);
});

check('action: no token for the mailbox throws before any write', async () => {
  const {service, calls} = load([['GET', SHORT, () => ({status: 403, body: 'nosdc'})]]);
  await assert.rejects(service.action({cmd: 'tr', email: 'ann@mail.ru', refs: REFS, prefs: {}, signal: signal()}), /Signed out/);
  assert.deepStrictEqual(calls.map(c => c.method), ['GET']);
});

check('action: archive and unknown commands throw without a request', async () => {
  const {service, calls} = load([], TOKENS);
  await assert.rejects(service.action({cmd: 'rc_^i', email: 'ann@mail.ru', refs: REFS, prefs: {doReadOnArchive: true}, signal: signal()}), /Not supported/);
  await assert.rejects(service.action({cmd: 'st', email: 'ann@mail.ru', refs: REFS, prefs: {}, signal: signal()}), /Not supported/);
  assert.strictEqual(calls.length, 0);
});

const letter = (body, extra = {}) => ({
  status: 200,
  body: {
    id: '101',
    subject: 'Отчёт',
    date: 1791733578,
    correspondents: {
      from: [{name: 'Анна', email: 'Anna@Example.com'}],
      to: [{name: 'Ann', email: 'ann@mail.ru'}, {name: '', email: 'team@mail.ru'}],
      cc: [{name: 'Bob', email: 'bob@bk.ru'}]
    },
    body,
    attaches: {list: [{name: 'a.pdf', href: {download: 'https://af.attachmail.ru/cgi-bin/readmsg/a.pdf?id=1'}}, {name: 'x', href: {}}]},
    ...extra
  }
});

check('body: the message as HTML, its people and files', async () => {
  const {service, calls} = load([['GET', MESSAGE, () => letter({html: '<p>Привет</p>', text: 'Привет'})]], TOKENS);
  const s = signal();
  const list = await service.body({email: 'ann@mail.ru', ref: {id: '101', folder: '0'}, signal: s});
  assert.deepStrictEqual(JSON.parse(JSON.stringify(list)), [{
    name: 'Анна',
    email: 'anna@example.com',
    date: new Date(1791733578000).toISOString(),
    to: 'Ann <ann@mail.ru>, team@mail.ru, Bob <bob@bk.ru>',
    html: '<p>Привет</p>',
    files: [{name: 'a.pdf', url: 'https://af.attachmail.ru/cgi-bin/readmsg/a.pdf?id=1'}]
  }]);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].signal, s);
  assert.deepStrictEqual(params(calls[0]), {id: '101', folder: '0', email: 'ann@mail.ru', mark_read: 'false', token: 't-ann', htmlencoded: 'false'});
});

check('body: a text body is escaped, missing parts stay empty', async () => {
  const {service} = load([['GET', MESSAGE, () => ({status: 200, body: {body: {text: 'a < b & "c"\nd', html: ' '}}})]], TOKENS);
  const [m] = await service.body({email: 'ann@mail.ru', ref: {id: '101', folder: '0'}, signal: signal()});
  assert.strictEqual(m.html, 'a &lt; b &amp; &quot;c&quot;<br>d');
  assert.deepStrictEqual([m.name, m.email, m.date, m.to, m.files.length], ['', '', '', '', 0]);
});

check('body: a stale token is replaced once', async () => {
  const {service, calls} = load([
    ['GET', SHORT, () => ({status: 200, body: {token: 'new'}})],
    ['GET', MESSAGE, req => params(req).token === 'new' ? letter({html: '<b>x</b>'}) : {status: 401}]
  ], TOKENS);
  const [m] = await service.body({email: 'ann@mail.ru', ref: {id: '101', folder: '0'}, signal: signal()});
  assert.strictEqual(m.html, '<b>x</b>');
  assert.strictEqual(calls.length, 3);
});

check('body: no body, an error status or a network failure throws', async () => {
  for (const reply of [() => letter(undefined), () => letter({}), () => ({status: 500}), () => html()]) {
    await assert.rejects(load([['GET', MESSAGE, reply]], TOKENS).service.body({email: 'ann@mail.ru', ref: {id: '101', folder: '0'}, signal: signal()}), /messages\/message: /);
  }
  await assert.rejects(load([['GET', MESSAGE, () => {
    throw new TypeError('Failed to fetch');
  }]], TOKENS).service.body({email: 'ann@mail.ru', ref: {id: '101', folder: '0'}, signal: signal()}), /Failed to fetch/);
});

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log('ok', name);
    }
    catch (e) {
      failed += 1;
      console.log('not ok', name);
      console.log(e);
    }
  }
  process.exit(failed ? 1 : 0);
})();
