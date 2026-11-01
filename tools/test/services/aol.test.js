// core/services/aol.js against a fake AOL Mail: the page's request id, the mailboxes call, the
// one batch per check, signing out, and what the actions and the reader send.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const FILE = path.join(__dirname, '../../../extension/core/services/aol.js');
const BASE = 'https://mail.aol.com';

const res = (body, {status = 200, url = ''} = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  url,
  text: async () => typeof body === 'string' ? body : JSON.stringify(body),
  json: async () => typeof body === 'string' ? JSON.parse(body) : structuredClone(body)
});
const PAGE = '<script>var conf = {"guidHash" : "G123"};</script>';
const MAILBOXES = {result: {mailboxes: [{id: 'MB9', isPrimary: true, wssid: 'Wss', email: 'Cy@AOL.com'}]}};
const FOLDERS = [
  {id: '1', name: 'Inbox', types: ['INBOX'], unread: 12},
  {id: '4', name: 'Trash', types: ['TRASH']},
  {id: '6', name: 'Bulk', types: ['BULK']},
  {id: '21', name: 'Archive', types: []}
];
const msg = (id, cid, date, read = false) => ({
  id, conversationId: cid, folder: {id: '1'}, flags: {read}, snippet: 's ' + id,
  headers: {subject: 'S ' + id, from: [{name: 'N ' + id, email: id + '@x.test'}], date}
});
const listing = () => ({result: {responses: [
  {id: 'ListFolders', httpCode: 200, response: {result: {folders: FOLDERS}}},
  {id: 'ListMessages1', httpCode: 200, response: {result: {messages: [msg('a', 'c1', 1761900000), msg('b', 'c2', 1761903600), msg('c', 'c3', 1761907200, true)]}}}
]}});
const written = {result: {responses: [{id: 'UpdateMessage', httpCode: 200, response: {result: {}}}]}};

const setup = route => {
  const store = {};
  const sent = [];
  const chrome = {storage: {session: {
    get: async k => (k in store ? {[k]: structuredClone(store[k])} : {}),
    set: async o => Object.assign(store, structuredClone(o)),
    remove: async k => delete store[k]
  }}};
  const fetch = async (url, o = {}) => {
    const u = new URL(url);
    const req = {method: o.method || 'GET', url, path: u.pathname, params: Object.fromEntries(u.searchParams),
      batch: o.body ? JSON.parse(o.body) : null, headers: o.headers || {}};
    sent.push(req);
    const r = route(req);
    if (r instanceof Error) {
      throw r;
    }
    if (!r) {
      throw Error('unexpected ' + req.method + ' ' + url);
    }
    return r;
  };
  const ctx = {chrome, fetch, URL, URLSearchParams, JSON, Date, Error, Promise, Map, Set};
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), ctx, {filename: 'aol.js'});
  return {aol: ctx.MailServices.aol, store, sent};
};
const aol = (extra = () => undefined) => setup(req => extra(req) || (req.path === '/' ? res(PAGE) :
  req.path === '/ws/v3/mailboxes' ? res(MAILBOXES) :
    req.path === '/ws/v3/batch' && !req.params.name ? res(listing()) : undefined));
const signal = new AbortController().signal;
const plain = x => JSON.parse(JSON.stringify(x));

const tests = [
  ['the page and the mailboxes call give the tokens, one batch lists the unread inbox', async () => {
    const t = aol();
    const [box] = plain(await t.aol.collect({signal}));
    assert.deepStrictEqual(t.sent.map(r => r.path), ['/', '/ws/v3/mailboxes', '/ws/v3/batch']);
    assert.deepStrictEqual(t.sent[1].params, {appid: 'aolwebmail', ymreqid: 'G123'});
    assert.strictEqual(t.sent[2].params.wssid, 'Wss');
    assert.strictEqual(t.sent[2].headers['content-type'], 'application/json');
    assert.ok(t.sent[2].batch.requests[0].uri.startsWith('/ws/v3/mailboxes/@.id==MB9/'));
    assert.strictEqual(box.email, 'cy@aol.com');
    assert.strictEqual(box.inbox, BASE + '/d/folders/1');
    assert.strictEqual(box.unread, 12);
    assert.deepStrictEqual(box.entries.map(e => e.id), ['aol:b', 'aol:a']);
    assert.strictEqual(box.entries[0].link, BASE + '/d/folders/1/messages/b');
    assert.deepStrictEqual(box.entries[0].ref, {mid: 'b', cid: 'c2', mids: ['b']});
    // no ARCHIVE type: the folder named Archive
    assert.strictEqual(t.store['service.aol'].folders.ARCHIVE, '21');
  }],
  ['the next check is one request', async () => {
    const t = aol();
    await t.aol.collect({signal});
    t.sent.length = 0;
    await t.aol.collect({signal});
    assert.deepStrictEqual(t.sent.map(r => r.path), ['/ws/v3/batch']);
  }],
  ['signed out: no request id in the page', async () => {
    const t = setup(req => req.path === '/' ? res('<html>AOL</html>') : undefined);
    assert.deepStrictEqual(plain(await t.aol.collect({signal})), []);
  }],
  ['signed out: the mailboxes call is refused', async () => {
    const t = aol(req => req.path === '/ws/v3/mailboxes' ? res('', {status: 401}) : undefined);
    assert.deepStrictEqual(plain(await t.aol.collect({signal})), []);
  }],
  ['too many requests is an error, not a sign-out', async () => {
    const t = aol(req => req.path === '/ws/v3/batch' ? res('', {status: 429}) : undefined);
    await assert.rejects(t.aol.collect({signal}), /rate limited/);
  }],
  ['a refusal other than 400/401 drops the tokens, so the next check reads the page again', async () => {
    for (const refused of [
      () => res({result: {responses: [{id: 'ListFolders', httpCode: 403}, {id: 'ListMessages1', httpCode: 404}]}}),
      () => res('', {status: 403}),
      () => res('<html>maintenance</html>')
    ]) {
      let refuse = false;
      const t = aol(req => refuse && req.path === '/ws/v3/batch' ? refused() : undefined);
      await t.aol.collect({signal});
      refuse = true;
      t.sent.length = 0;
      await assert.rejects(t.aol.collect({signal}));
      assert.deepStrictEqual(t.sent.map(r => r.path), ['/ws/v3/batch']);
      assert.strictEqual(t.store['service.aol'], undefined);
      refuse = false;
      t.sent.length = 0;
      const [box] = await t.aol.collect({signal});
      assert.strictEqual(box.email, 'cy@aol.com');
      assert.deepStrictEqual(t.sent.map(r => r.path), ['/', '/ws/v3/mailboxes', '/ws/v3/batch']);
    }
  }],
  ['delete moves the conversation to the trash', async () => {
    const t = aol(req => req.params.name ? res(written) : undefined);
    await t.aol.collect({signal});
    await t.aol.action({cmd: 'tr', email: 'cy@aol.com', refs: [{mid: 'b', mids: ['b', 'x']}], signal});
    const w = t.sent.at(-1);
    assert.strictEqual(w.params.name, 'messages.move');
    assert.strictEqual(w.params.wssid, 'Wss');
    assert.ok(decodeURIComponent(w.batch.requests[0].uri).endsWith('?q=id:(b x)'));
    assert.deepStrictEqual(w.batch.requests[0].payload, {message: {folder: {id: '4'}}});
  }],
  ['mark read', async () => {
    const t = aol(req => req.params.name ? res(written) : undefined);
    await t.aol.collect({signal});
    await t.aol.action({cmd: 'rd', email: 'cy@aol.com', refs: [{mid: 'a'}], signal});
    assert.deepStrictEqual(t.sent.at(-1).batch.requests[0].payload, {message: {flags: {read: true}}});
  }],
  ['an action for another account sends no write', async () => {
    const t = aol(req => req.params.name ? res(written) : undefined);
    await t.aol.collect({signal});
    await assert.rejects(t.aol.action({cmd: 'rd', email: 'dee@aol.com', refs: [{mid: 'a'}], signal}), /another account/);
    assert.strictEqual(t.sent.filter(r => r.params.name).length, 0);
  }],
  ['the reader gets the messages', async () => {
    const t = aol(req => req.params.name === 'messages.getBodies' ? res({result: {responses: [
      {id: 'GetSimpleBody_0', httpCode: 200, response: {result: {message: {headers: {from: [{name: 'N', email: 'n@x.test'}], date: 1761900000}}, simpleBody: {html: '<b>hi</b>'}}}}
    ]}}) : undefined);
    await t.aol.collect({signal});
    const [m] = plain(await t.aol.body({email: 'cy@aol.com', ref: {mid: 'a', mids: ['a']}, signal}));
    assert.strictEqual(m.html, '<b>hi</b>');
    assert.strictEqual(m.name, 'N');
  }]
];

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log('ok', name);
    }
    catch (e) {
      failed += 1;
      console.log('not ok', name, '-', e.message);
    }
  }
  process.exit(failed ? 1 : 0);
})();
