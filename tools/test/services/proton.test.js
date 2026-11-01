// core/services/proton.js against a fake Proton Mail API: two signed-in sessions, token refresh,
// app version renewal, errors, and the requests of every action.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const FILE = path.join(__dirname, '../../../extension/core/services/proton.js');
const SOURCE = fs.readFileSync(FILE, 'utf8');
const API = 'https://mail.proton.me/api/';

// objects made inside the vm have other prototypes; compare plain copies
const plain = v => JSON.parse(JSON.stringify(v));
const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});

// Fixtures in the shapes go-proton-api and Mail Notifier Hub read (synthetic values).
const USERS = {
  cA: {ID: 'userA', Name: 'ann', DisplayName: 'Ann', Email: 'Ann@proton.me'},
  cB: {ID: 'userB', Name: 'bob', DisplayName: 'Bob', Email: 'bob@pm.me'}
};
const SESSIONS = [
  {UID: 'x1', LocalID: 1, UserID: 'userB', Username: 'bob', DisplayName: 'Bob', PrimaryEmail: 'bob@pm.me'},
  {UID: 'x0', LocalID: 0, UserID: 'userA', Username: 'ann', DisplayName: 'Ann', PrimaryEmail: 'ann@proton.me'}
];
const MESSAGES = [
  {ID: 'm1==', ConversationID: 'c1==', Subject: 'Older', Sender: {Name: 'Carl', Address: 'Carl@Example.com'}, Time: 1793430000, Unread: 1, LabelIDs: ['0', '5']},
  {ID: 'm2-_', ConversationID: 'c2==', Subject: 'Newer', Sender: {Name: '', Address: 'dora@example.com'}, Time: 1793440000, Unread: 1, LabelIDs: ['0', '5']},
  {ID: 'm3', ConversationID: 'c2==', Subject: 'Same thread', Sender: {Name: 'Dora', Address: 'dora@example.com'}, Time: 1793435000, Unread: 1, LabelIDs: ['0', '5']}
];
const ok = ids => json({Code: 1001, Responses: ids.map(ID => ({ID, Response: {Code: 1000}}))});

/*
 * A fake Proton. routes: overrides keyed 'METHOD path' (path after /api/, without the query), each a
 * function (request) -> Response or a list of them used in turn (the last one repeats).
 */
const setup = ({cookies = ['AUTH-cA', 'AUTH-cB', 'Session-Id'], routes = {}, tabs = [], session = {}} = {}) => {
  const calls = [];
  const turn = {};
  const base = {
    'GET version.json': () => json({branch: 'proton-mail@5.0.138.11', version: '5.0.138.11', commit: 'abc'}),
    'GET auth/v4/sessions/local': () => json({Code: 1000, Sessions: SESSIONS}),
    'GET core/v4/users': r => json({Code: 1000, User: USERS[r.uid]}),
    'GET mail/v4/settings': r => json({Code: 1000, MailSettings: {ViewMode: r.uid === 'cB' ? 1 : 0}}),
    'GET mail/v4/messages/count': r => json({Code: 1000, Counts: [
      {LabelID: '5', Total: 40, Unread: 9},
      {LabelID: '0', Total: 10, Unread: r.uid === 'cA' ? 3 : 0}
    ]}),
    'GET mail/v4/messages': () => json({Code: 1000, Total: 3, Messages: MESSAGES, Stale: 0}),
    'POST auth/refresh': () => json({Code: 1000, UID: 'cA'})
  };
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    const p = u.pathname === '/assets/version.json' ? 'version.json' : u.pathname.replace(/^\/api\//, '');
    const method = init.method || 'GET';
    const h = init.headers || {};
    const r = {method, path: p, url: u.href, query: Object.fromEntries(u.searchParams), headers: h, uid: h['x-pm-uid'],
      body: init.body === undefined ? undefined : JSON.parse(init.body), credentials: init.credentials, signal: init.signal};
    calls.push(r);
    const key = method + ' ' + p;
    let handler = routes[key] || base[key];
    if (Array.isArray(handler)) {
      turn[key] = (turn[key] || 0) + 1;
      handler = handler[Math.min(turn[key], handler.length) - 1];
    }
    if (!handler) {
      throw new Error('unexpected request ' + key);
    }
    return handler(r);
  };
  const store = {...session};
  const chrome = {
    cookies: {getAll: async ({url}) => url === API ? cookies.map(name => ({name, value: 'v', path: '/api/'})) : []},
    storage: {session: {
      get: async key => (key in store ? {[key]: JSON.parse(JSON.stringify(store[key]))} : {}),
      set: async o => Object.assign(store, JSON.parse(JSON.stringify(o)))
    }},
    tabs: {query: async () => tabs.map(url => ({url}))}
  };
  const ctx = {fetch, chrome, URL, URLSearchParams, Response, console};
  ctx.self = ctx;
  vm.runInNewContext(SOURCE, ctx, {filename: FILE});
  return {service: ctx.MailServices.proton, calls, store, count: key => calls.filter(c => c.method + ' ' + c.path === key).length};
};

let n = 0;
const failures = [];
const check = async (name, fn) => {
  try {
    await fn();
    n += 1;
    console.log('ok', name);
  }
  catch (e) {
    failures.push(name);
    console.log('not ok', name);
    console.log(e);
  }
};
const rejects = async (promise, re) => {
  let error;
  try {
    await promise;
  }
  catch (e) {
    error = e;
  }
  assert.ok(error, 'expected a rejection');
  assert.match(String(error.message), re);
};

(async () => {
  await check('static fields', () => {
    const {service} = setup();
    assert.strictEqual(service.id, 'proton');
    assert.strictEqual(service.name, 'Proton Mail');
    assert.deepStrictEqual(plain(service.origins), ['https://mail.proton.me/*']);
    assert.deepStrictEqual(plain(service.hosts), ['https://mail.proton.me/']);
    assert.strictEqual(service.signIn, 'https://account.proton.me/mail');
    assert.deepStrictEqual(plain(service.can), {archive: true, spam: true, body: false});
    assert.deepStrictEqual(plain(service.rewrite), []);
    assert.strictEqual(service.body, undefined);
  });

  await check('compose: #mailto handoff, encoded once more as the web app expects', () => {
    const {service} = setup();
    assert.strictEqual(service.compose(), 'https://mail.proton.me/inbox#mailto=mailto%3A');
    const url = service.compose('ann@proton.me', 'Hi & bye');
    assert.ok(url.startsWith('https://mail.proton.me/inbox#mailto=mailto%3A'));
    assert.strictEqual(decodeURIComponent(url.split('#mailto=')[1]), 'mailto:ann@proton.me?subject=Hi%20%26%20bye');
    assert.strictEqual(decodeURIComponent(service.compose('a@b.c?cc=x').split('#mailto=')[1]), 'mailto:a@b.ccc=x');
  });

  await check('collect: two sessions, fields, order, counts', async () => {
    const {service, calls, count} = setup();
    const boxes = plain(await service.collect({}));
    assert.deepStrictEqual(boxes.map(b => [b.email, b.inbox, b.unread, b.entries.length]), [
      ['ann@proton.me', 'https://mail.proton.me/u/0/inbox', 3, 3],
      ['bob@pm.me', 'https://mail.proton.me/u/1/inbox', 0, 0]
    ]);
    const [first, second, third] = boxes[0].entries;
    assert.deepStrictEqual(first, {
      id: 'proton:m2-_',
      link: 'https://mail.proton.me/u/0/inbox/c2==/m2-_',
      ref: {id: 'm2-_', cid: 'c2=='},
      title: 'Newer',
      summary: '',
      modified: '2026-10-31T09:46:40.000Z',
      author_name: 'dora@example.com',
      author_email: 'dora@example.com'
    });
    assert.deepStrictEqual([second.id, third.id], ['proton:m3', 'proton:m1==']);
    assert.strictEqual(third.author_email, 'carl@example.com');
    const all = boxes.flatMap(b => b.entries);
    assert.strictEqual(new Set(all.map(e => e.id)).size, all.length);
    assert.strictEqual(new Set(all.map(e => e.link)).size, all.length);
    assert.strictEqual(new Set(boxes.map(b => b.inbox)).size, boxes.length);
    // every API call names its session and the live app version
    for (const c of calls.filter(c => c.path !== 'version.json')) {
      assert.ok(['cA', 'cB'].includes(c.headers['x-pm-uid']), c.path);
      assert.strictEqual(c.headers['x-pm-appversion'], 'web-mail@5.0.138.11');
      assert.strictEqual(c.headers.Accept, 'application/vnd.protonmail.v1+json');
      assert.strictEqual(c.credentials, 'include');
    }
    const list = calls.filter(c => c.path === 'mail/v4/messages');
    assert.deepStrictEqual(list.map(c => c.uid), ['cA']); // nothing unread for bob: no list request
    assert.deepStrictEqual(list[0].query, {LabelID: '0', Unread: '1', Page: '0', PageSize: '20', Sort: 'Time', Desc: '1'});
    assert.strictEqual(count('GET version.json'), 1);
    assert.strictEqual(count('GET auth/v4/sessions/local'), 1);
    assert.strictEqual(count('GET core/v4/users'), 2);
  });

  await check('collect: a single-message account links the message, not the conversation', async () => {
    const {service} = setup({routes: {
      'GET mail/v4/messages/count': () => json({Code: 1000, Counts: [{LabelID: '0', Total: 1, Unread: 1}]})
    }});
    const boxes = plain(await service.collect({}));
    assert.strictEqual(boxes[1].entries[0].link, 'https://mail.proton.me/u/1/inbox/m2-_');
    assert.strictEqual(boxes[0].entries[0].link, 'https://mail.proton.me/u/0/inbox/c2==/m2-_');
  });

  await check('collect: the next check reuses identity, slot and version', async () => {
    const {service, calls, store} = setup();
    await service.collect({});
    calls.length = 0;
    await service.collect({});
    assert.deepStrictEqual(calls.map(c => c.method + ' ' + c.path + ' ' + c.uid), [
      'GET mail/v4/messages/count cA',
      'GET mail/v4/messages/count cB',
      'GET mail/v4/messages cA'
    ]);
    assert.strictEqual(store['service.proton'].version, '5.0.138.11');
    assert.strictEqual(store['service.proton'].mailboxes['bob@pm.me'], 'cB');
  });

  await check('collect: the signal reaches every request', async () => {
    const {service, calls} = setup();
    const signal = new AbortController().signal;
    await service.collect({signal});
    assert.ok(calls.length > 0 && calls.every(c => c.signal === signal));
  });

  await check('collect: no AUTH cookie resolves [] without a request', async () => {
    const {service, calls} = setup({cookies: ['Session-Id', 'Tag']});
    assert.deepStrictEqual(plain(await service.collect({})), []);
    assert.strictEqual(calls.length, 0);
  });

  await check('collect: sessions whose refresh is refused are signed out', async () => {
    const {service, count} = setup({routes: {
      'GET mail/v4/messages/count': () => json({Code: 401, Error: 'Invalid access token'}, 401),
      'POST auth/refresh': () => json({Code: 10013, Error: 'Invalid refresh token'}, 422)
    }});
    assert.deepStrictEqual(plain(await service.collect({})), []);
    assert.strictEqual(count('POST auth/refresh'), 2); // once per session
    assert.strictEqual(count('GET mail/v4/messages/count'), 2);
  });

  await check('collect: an expired token is refreshed once and the request repeated', async () => {
    const {service, calls} = setup({cookies: ['AUTH-cA'], routes: {
      'GET mail/v4/messages/count': [
        () => json({Code: 401, Error: 'Invalid access token'}, 401),
        () => json({Code: 1000, Counts: [{LabelID: '0', Total: 1, Unread: 0}]})
      ]
    }});
    const boxes = plain(await service.collect({}));
    assert.deepStrictEqual(boxes.map(b => [b.email, b.unread]), [['ann@proton.me', 0]]);
    const refresh = calls.filter(c => c.path === 'auth/refresh');
    assert.strictEqual(refresh.length, 1);
    assert.strictEqual(refresh[0].method, 'POST');
    assert.strictEqual(refresh[0].uid, 'cA');
    assert.strictEqual(refresh[0].body, undefined);
    assert.strictEqual(refresh[0].credentials, 'include');
  });

  await check('collect: checks running together share one refresh', async () => {
    let renewed = false;
    const {service, count} = setup({cookies: ['AUTH-cA'], routes: {
      'GET mail/v4/messages/count': () => renewed ?
        json({Code: 1000, Counts: [{LabelID: '0', Total: 0, Unread: 0}]}) :
        json({Code: 401}, 401),
      'POST auth/refresh': () => new Promise(resolve => setTimeout(() => {
        renewed = true;
        resolve(json({Code: 1000}));
      }, 20))
    }});
    const [a, b] = await Promise.all([service.collect({}), service.collect({})]);
    assert.deepStrictEqual([plain(a).length, plain(b).length], [1, 1]);
    assert.strictEqual(count('POST auth/refresh'), 1);
  });

  await check('collect: still 401 after a refresh is signed out, with no second refresh', async () => {
    const {service, count} = setup({cookies: ['AUTH-cA'], routes: {
      'GET mail/v4/messages/count': () => json({Code: 401}, 401)
    }});
    assert.deepStrictEqual(plain(await service.collect({})), []);
    assert.strictEqual(count('POST auth/refresh'), 1);
    assert.strictEqual(count('GET mail/v4/messages/count'), 2);
  });

  await check('collect: an open tab of that session is left to refresh it', async () => {
    const routes = {'GET mail/v4/messages/count': () => json({Code: 401}, 401)};
    const {service, count} = setup({cookies: ['AUTH-cA'], routes, tabs: ['https://mail.proton.me/u/0/inbox'],
      session: {'service.proton': {users: {cA: {id: 'userA', email: 'ann@proton.me', slot: 0, view: 0, at: Date.now()}}}}});
    await rejects(service.collect({}), /open tab/);
    assert.strictEqual(count('POST auth/refresh'), 0);
    // a tab of another account does not hold the refresh back
    const other = setup({cookies: ['AUTH-cA'], routes, tabs: ['https://mail.proton.me/u/3/inbox'],
      session: {'service.proton': {users: {cA: {id: 'userA', email: 'ann@proton.me', slot: 0, view: 0, at: Date.now()}}}}});
    await other.service.collect({});
    assert.strictEqual(other.count('POST auth/refresh'), 1);
  });

  await check('collect: a session left to an open tab does not take the other sessions with it', async () => {
    // after a browser start nothing is known: bob's token has expired, a tab shows ann's /u/0
    const {service, count} = setup({tabs: ['https://mail.proton.me/u/0/inbox'], routes: {
      'GET mail/v4/messages/count': r => r.uid === 'cB' ? json({Code: 401}, 401) :
        json({Code: 1000, Counts: [{LabelID: '0', Total: 3, Unread: 3}]})
    }});
    const boxes = plain(await service.collect({}));
    assert.deepStrictEqual(boxes.map(b => [b.email, b.unread]), [['ann@proton.me', 3]]);
    assert.strictEqual(count('POST auth/refresh'), 0);
  });

  await check('collect: a known session that fails shows its last mailbox, the others their new one', async () => {
    let down = false;
    const {service} = setup({routes: {
      'GET mail/v4/messages/count': r => down && r.uid === 'cB' ? json({Code: 500}, 500) :
        json({Code: 1000, Counts: [{LabelID: '0', Total: 10, Unread: r.uid === 'cA' ? (down ? 4 : 3) : 1}]})
    }});
    const before = plain(await service.collect({}));
    down = true;
    const after = plain(await service.collect({}));
    assert.deepStrictEqual(after.map(b => [b.email, b.unread]), [['ann@proton.me', 4], ['bob@pm.me', 1]]);
    assert.deepStrictEqual(after[1], before[1]);
  });

  await check('collect: the sessions are asked at once, with one version.json', async () => {
    let open = 0;
    let most = 0;
    const {service, count} = setup({routes: {
      'GET mail/v4/messages/count': () => {
        open += 1;
        most = Math.max(most, open);
        return new Promise(resolve => setTimeout(() => {
          open -= 1;
          resolve(json({Code: 1000, Counts: [{LabelID: '0', Total: 0, Unread: 0}]}));
        }, 10));
      }
    }});
    await service.collect({});
    assert.strictEqual(most, 2);
    assert.strictEqual(count('GET version.json'), 1);
  });

  await check('collect: an old app version is renewed once, then the request repeated', async () => {
    const {service, calls, store, count} = setup({cookies: ['AUTH-cA'],
      session: {'service.proton': {version: '5.0.100.1'}},
      routes: {
        'GET mail/v4/messages/count': r => r.headers['x-pm-appversion'] === 'web-mail@5.0.100.1' ?
          json({Code: 5003, Error: 'This version of the app is no longer supported'}, 400) :
          json({Code: 1000, Counts: [{LabelID: '0', Total: 0, Unread: 0}]})
      }});
    await service.collect({});
    assert.strictEqual(count('GET version.json'), 1);
    assert.deepStrictEqual(calls.filter(c => c.path === 'mail/v4/messages/count').map(c => c.headers['x-pm-appversion']),
      ['web-mail@5.0.100.1', 'web-mail@5.0.138.11']);
    assert.strictEqual(store['service.proton'].version, '5.0.138.11');
  });

  await check('collect: a version still refused is not renewed again', async () => {
    const {service, count} = setup({cookies: ['AUTH-cA'], routes: {
      'GET mail/v4/messages/count': () => json({Code: 5003}, 400)
    }});
    await rejects(service.collect({}), /HTTP 400 \(5003\)/);
    assert.strictEqual(count('GET version.json'), 2); // the first one, and one renewal
    assert.strictEqual(count('GET mail/v4/messages/count'), 2);
  });

  await check('collect: a network error throws', async () => {
    const {service} = setup({routes: {'GET mail/v4/messages/count': () => Promise.reject(new TypeError('Failed to fetch'))}});
    await rejects(service.collect({}), /Failed to fetch/);
  });

  await check('collect: no version.json throws', async () => {
    const {service} = setup({routes: {'GET version.json': () => new Response('gone', {status: 503})}});
    await rejects(service.collect({}), /no app version/);
  });

  await check('collect: 429 throws rate limited', async () => {
    const {service} = setup({routes: {'GET mail/v4/messages/count': () => json({Code: 2028}, 429)}});
    await rejects(service.collect({}), /^rate limited$/);
  });

  await check('collect: human verification throws a short error', async () => {
    const {service} = setup({routes: {'GET mail/v4/messages/count': () => json({Code: 9001, Error: 'Human verification required'}, 422)}});
    await rejects(service.collect({}), /human verification/);
  });

  await check('collect: an answer it cannot read throws', async () => {
    const counts = setup({routes: {'GET mail/v4/messages/count': () => json({Code: 1000, Counts: [{LabelID: '5', Unread: 1}]})}});
    await rejects(counts.service.collect({}), /unreadable count/);
    const page = setup({routes: {'GET mail/v4/messages/count': () => new Response('<html>maintenance</html>', {status: 200})}});
    await rejects(page.service.collect({}), /unreadable answer/);
    const list = setup({cookies: ['AUTH-cA'], routes: {'GET mail/v4/messages': () => json({Code: 1000})}});
    await rejects(list.service.collect({}), /unreadable list/);
  });

  await check('collect: a stale list is asked once more', async () => {
    const {service, count} = setup({cookies: ['AUTH-cA'], routes: {
      'GET mail/v4/messages': [() => json({Code: 1000, Messages: [], Stale: 1}), () => json({Code: 1000, Messages: MESSAGES, Stale: 0})]
    }});
    const boxes = plain(await service.collect({}));
    assert.strictEqual(boxes[0].entries.length, 3);
    assert.strictEqual(count('GET mail/v4/messages'), 2);
  });

  await check('collect: a session that signs out while being identified is left out', async () => {
    const {service, calls} = setup({routes: {
      'GET core/v4/users': r => r.uid === 'cA' ? json({Code: 401}, 401) : json({Code: 1000, User: USERS[r.uid]}),
      'POST auth/refresh': () => json({Code: 10013}, 400)
    }});
    const boxes = plain(await service.collect({}));
    assert.deepStrictEqual(boxes.map(b => b.email), ['bob@pm.me']);
    assert.strictEqual(calls.filter(c => c.path === 'mail/v4/messages').length, 0);
  });

  await check('collect: two cookies of one account give one mailbox', async () => {
    const {service} = setup({cookies: ['AUTH-cA', 'AUTH-cA2'], routes: {
      'GET core/v4/users': () => json({Code: 1000, User: USERS.cA})
    }});
    const boxes = plain(await service.collect({}));
    assert.deepStrictEqual(boxes.map(b => b.email), ['ann@proton.me']);
  });

  const acted = async (cmd, prefs, routes = {}) => {
    const t = setup({routes});
    await t.service.collect({});
    t.calls.length = 0;
    const refs = [{id: 'm1==', cid: 'c1=='}, {id: 'm3', cid: 'c2=='}];
    const result = await t.service.action({cmd, email: 'ann@proton.me', refs, prefs});
    return {result, writes: t.calls.map(c => [c.method, c.url, c.uid, c.body])};
  };
  const IDS = ['m1==', 'm3'];

  await check('action rd: PUT messages/read', async () => {
    const {result, writes} = await acted('rd', {}, {'PUT mail/v4/messages/read': () => ok(IDS)});
    assert.strictEqual(result, true);
    assert.deepStrictEqual(writes, [['PUT', API + 'mail/v4/messages/read', 'cA', {IDs: IDS}]]);
  });

  await check('action rc_^i: label 6, then read when doReadOnArchive', async () => {
    const routes = {'PUT mail/v4/messages/label': () => ok(IDS), 'PUT mail/v4/messages/read': () => ok(IDS)};
    const {writes} = await acted('rc_^i', {doReadOnArchive: true}, routes);
    assert.deepStrictEqual(writes, [
      ['PUT', API + 'mail/v4/messages/label', 'cA', {LabelID: '6', IDs: IDS}],
      ['PUT', API + 'mail/v4/messages/read', 'cA', {IDs: IDS}]
    ]);
    const plainArchive = await acted('rc_^i', {doReadOnArchive: false}, routes);
    assert.deepStrictEqual(plainArchive.writes, [['PUT', API + 'mail/v4/messages/label', 'cA', {LabelID: '6', IDs: IDS}]]);
  });

  await check('action tr: label 3 (trash, recoverable)', async () => {
    const {writes} = await acted('tr', {}, {'PUT mail/v4/messages/label': () => ok(IDS)});
    assert.deepStrictEqual(writes, [['PUT', API + 'mail/v4/messages/label', 'cA', {LabelID: '3', IDs: IDS}]]);
  });

  await check('action sp: label 4', async () => {
    const {writes} = await acted('sp', {}, {'PUT mail/v4/messages/label': () => ok(IDS)});
    assert.deepStrictEqual(writes, [['PUT', API + 'mail/v4/messages/label', 'cA', {LabelID: '4', IDs: IDS}]]);
  });

  await check('action: one refused message fails it, and a failed archive is not marked read', async () => {
    const partial = () => json({Code: 1001, Responses: [{ID: 'm1==', Response: {Code: 1000}}, {ID: 'm3', Response: {Code: 2501, Error: 'Message does not exist'}}]});
    await rejects(acted('rd', {}, {'PUT mail/v4/messages/read': partial}), /rejected/);
    let reads = 0;
    await rejects(acted('rc_^i', {doReadOnArchive: true}, {
      'PUT mail/v4/messages/label': partial,
      'PUT mail/v4/messages/read': () => (reads++, ok(IDS))
    }), /rejected/);
    assert.strictEqual(reads, 0);
    await rejects(acted('tr', {}, {'PUT mail/v4/messages/label': () => json({Code: 1001})}), /rejected/);
    await rejects(acted('sp', {}, {'PUT mail/v4/messages/label': () => json({Code: 500, Error: 'Internal'}, 500)}), /HTTP 500/);
  });

  await check('action: a write is never repeated after an error', async () => {
    let n = 0;
    await rejects(acted('tr', {}, {'PUT mail/v4/messages/label': () => (n++, json({Code: 2001}, 409))}), /HTTP 409/);
    assert.strictEqual(n, 1);
  });

  await check('action: a mailbox not known yet is found through its session', async () => {
    const t = setup({routes: {'PUT mail/v4/messages/read': () => ok(['m9'])}});
    assert.strictEqual(await t.service.action({cmd: 'rd', email: 'bob@pm.me', refs: [{id: 'm9'}], prefs: {}}), true);
    assert.deepStrictEqual(t.calls.filter(c => c.method === 'PUT').map(c => c.uid), ['cB']);
  });

  await check('action: a session that could not be asked is the error when its mailbox is not found', async () => {
    const t = setup({routes: {'GET core/v4/users': r => r.uid === 'cB' ? json({Code: 500}, 500) : json({Code: 1000, User: USERS[r.uid]})}});
    await rejects(t.service.action({cmd: 'rd', email: 'bob@pm.me', refs: [{id: 'm9'}], prefs: {}}), /HTTP 500/);
    assert.strictEqual(t.calls.filter(c => c.method === 'PUT').length, 0);
  });

  await check('action: unknown mailbox, unknown command and no refs throw', async () => {
    const t = setup();
    await t.service.collect({});
    await rejects(t.service.action({cmd: 'rd', email: 'eve@proton.me', refs: [{id: 'm1'}]}), /not signed in/);
    await rejects(t.service.action({cmd: 'xx', email: 'ann@proton.me', refs: [{id: 'm1'}]}), /unknown action/);
    await rejects(t.service.action({cmd: 'rd', email: 'ann@proton.me', refs: []}), /no message/);
  });

  await check('body: not offered (end-to-end encrypted)', () => {
    const {service} = setup();
    assert.strictEqual(service.can.body, false);
    assert.strictEqual(typeof service.body, 'undefined');
  });

  await check('no top-level names besides MailServices', () => {
    const ctx = {self: null};
    ctx.self = ctx;
    vm.runInNewContext(SOURCE, ctx);
    assert.deepStrictEqual(Object.keys(ctx).sort(), ['MailServices', 'self']);
  });

  console.log(n, 'checks passed');
  if (failures.length) {
    console.log(failures.length, 'failed:', failures.join(', '));
    process.exit(1);
  }
})();
