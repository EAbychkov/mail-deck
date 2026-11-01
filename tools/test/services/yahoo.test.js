// core/services/yahoo.js against a fake Yahoo Mail: the page's tokens, the one batch per check,
// stale tokens, signing out, and what every action and the reader send.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const FILE = path.join(__dirname, '../../../extension/core/services/yahoo.js');
const BASE = 'https://mail.yahoo.com';

const res = (body, {status = 200, url = ''} = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  url,
  text: async () => typeof body === 'string' ? body : JSON.stringify(body),
  json: async () => typeof body === 'string' ? JSON.parse(body) : structuredClone(body)
});
const PAGE = '<script>window.data = {"mailboxes":{"selectedMailboxId":"MB\\u002F1","mailWssid":"W\\u002Fss"},"accounts":[{"id":"1","email":"Ann@Yahoo.com"}]};</script>';
const FOLDERS = [
  {id: '1', name: 'Inbox', types: ['INBOX'], unread: 37, acctId: '1'},
  {id: '4', name: 'Trash', types: ['TRASH'], acctId: '1'},
  {id: '6', name: 'Bulk', types: ['BULK'], acctId: '1'},
  {id: '21', name: 'Archive', types: ['ARCHIVE'], acctId: '1'},
  {id: '99', name: 'Inbox', types: ['INBOX'], unread: 5, acctId: '2'}
];
const msg = (id, cid, date, {folder = '1', read = false, types = ['INBOX']} = {}) => ({
  id, conversationId: cid, folder: {id: folder, types, acctId: '1'}, flags: {read}, snippet: 'about ' + id,
  headers: {subject: 'Subject ' + id, from: [{name: 'Bo ' + id, email: id + '@x.test'}], date}
});
const MESSAGES = [
  msg('m1', 'c1', 1761900000),
  msg('m2', 'c2', 1761903600),
  msg('m3', 'c1', 1761907200),
  msg('m4', 'c3', 1761910800, {read: true}),
  msg('m5', 'c4', 1761914400, {folder: '6', types: ['BULK']})
];
const listing = () => ({result: {status: {failedRequests: []}, responses: [
  {id: 'GetFolders', httpCode: 200, response: {result: {folders: FOLDERS}}},
  {id: 'GetMessageGroupList', httpCode: 200, response: {result: {messages: MESSAGES}}}
]}});
const written = id => ({result: {responses: [{id, httpCode: 200, response: {result: {}}}]}});

// routes: (request) => response | undefined; every request is recorded
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
    const batch = o.body && typeof o.body.get === 'function' ? JSON.parse(o.body.get('batchJson')) : null;
    const req = {method: o.method || 'GET', url, path: u.pathname, params: Object.fromEntries(u.searchParams), batch};
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
  const ctx = {chrome, fetch, FormData, URL, URLSearchParams, JSON, Date, Error, Promise, Map, Set};
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), ctx, {filename: 'yahoo.js'});
  return {yahoo: ctx.MailServices.yahoo, store, sent};
};
// a Yahoo that is signed in and answers every read
const yahoo = (extra = () => undefined) => setup(req => extra(req) || (req.path === '/' ? res(PAGE) :
  req.path === '/ws/v3/batch' && !req.params.name ? res(listing()) : undefined));
const signal = new AbortController().signal;
const plain = x => JSON.parse(JSON.stringify(x));

const tests = [
  ['the page gives the tokens, one batch lists the unread inbox by conversation', async () => {
    const t = yahoo();
    const [box] = plain(await t.yahoo.collect({signal}));
    assert.deepStrictEqual(t.sent.map(r => r.method + ' ' + r.path), ['GET /', 'POST /ws/v3/batch']);
    assert.deepStrictEqual(t.sent[1].batch.requests.map(r => r.id), ['GetFolders', 'GetMessageGroupList']);
    assert.ok(t.sent[1].batch.requests[0].uri.startsWith('/ws/v3/mailboxes/@.id==MB%2F1/'));
    assert.strictEqual(box.email, 'ann@yahoo.com');
    assert.strictEqual(box.inbox, BASE + '/n/folders/1');
    // only the primary account's inbox counts
    assert.strictEqual(box.unread, 37);
    // newest first; c1 shown by its newest message m3 with both unread messages; read and bulk left out
    assert.deepStrictEqual(box.entries.map(e => e.id), ['yahoo:m3', 'yahoo:m2']);
    const [c1] = box.entries;
    assert.deepStrictEqual(c1.ref, {mid: 'm3', cid: 'c1', mids: ['m1', 'm3']});
    assert.strictEqual(c1.link, BASE + '/n/folders/1/messages/c1');
    assert.strictEqual(c1.title, 'Subject m3');
    assert.strictEqual(c1.summary, 'about m3');
    assert.strictEqual(c1.author_name, 'Bo m3');
    assert.strictEqual(c1.author_email, 'm3@x.test');
    assert.strictEqual(c1.modified, new Date(1761907200000).toISOString());
    assert.deepStrictEqual(t.store['service.yahoo'].folders, {INBOX: '1', TRASH: '4', BULK: '6', ARCHIVE: '21'});
    assert.strictEqual(t.store['service.yahoo'].wssid, 'W/ss');
  }],
  ['the next check is one request', async () => {
    const t = yahoo();
    await t.yahoo.collect({signal});
    t.sent.length = 0;
    await t.yahoo.collect({signal});
    assert.deepStrictEqual(t.sent.map(r => r.path), ['/ws/v3/batch']);
  }],
  ['stale tokens are read again from the page, once', async () => {
    let first = true;
    const t = yahoo(req => {
      if (req.path === '/ws/v3/batch' && first) {
        first = false;
        return res('', {status: 401});
      }
    });
    t.store['service.yahoo'] = {mailboxId: 'OLD', wssid: 'old', email: 'ann@yahoo.com', folders: {}};
    const [box] = await t.yahoo.collect({signal});
    assert.strictEqual(box.entries.length, 2);
    assert.deepStrictEqual(t.sent.map(r => r.path), ['/ws/v3/batch', '/', '/ws/v3/batch']);
    assert.strictEqual(t.store['service.yahoo'].mailboxId, 'MB/1');
  }],
  ['signed out: the landing page has no mailbox', async () => {
    const t = setup(req => req.path === '/' ? res('<html>Yahoo Mail</html>') : undefined);
    assert.deepStrictEqual(plain(await t.yahoo.collect({signal})), []);
  }],
  ['signed out: sent to the sign-in page', async () => {
    const t = setup(() => res('', {url: 'https://login.yahoo.com/?done=x'}));
    assert.deepStrictEqual(plain(await t.yahoo.collect({signal})), []);
  }],
  ['signed out: fresh tokens still refused', async () => {
    const t = yahoo(req => req.path === '/ws/v3/batch' ? res('', {status: 401}) : undefined);
    assert.deepStrictEqual(plain(await t.yahoo.collect({signal})), []);
    assert.strictEqual(t.store['service.yahoo'], undefined);
  }],
  ['too many requests is an error, not a sign-out', async () => {
    const t = yahoo(req => req.path === '/ws/v3/batch' ? res('', {status: 429}) : undefined);
    await assert.rejects(t.yahoo.collect({signal}), /rate limited/);
  }],
  ['a network failure is an error', async () => {
    const t = setup(() => Error('offline'));
    await assert.rejects(t.yahoo.collect({signal}), /offline/);
  }],
  ['an answer it cannot read is an error', async () => {
    const t = yahoo(req => req.path === '/ws/v3/batch' ? res({result: {}}) : undefined);
    await assert.rejects(t.yahoo.collect({signal}), /unreadable/);
  }],
  ['a refusal other than 400/401 drops the tokens, so the next check reads the page again', async () => {
    for (const refused of [
      () => res({result: {responses: [{id: 'GetFolders', httpCode: 403, response: {error: {code: 'EC-4003'}}}, {id: 'GetMessageGroupList', httpCode: 403}]}}),
      () => res('', {status: 403}),
      () => res('', {status: 503})
    ]) {
      let refuse = false;
      const t = yahoo(req => refuse && req.path === '/ws/v3/batch' ? refused() : undefined);
      await t.yahoo.collect({signal});
      refuse = true;
      t.sent.length = 0;
      await assert.rejects(t.yahoo.collect({signal}));
      // no second try in the same call
      assert.deepStrictEqual(t.sent.map(r => r.path), ['/ws/v3/batch']);
      assert.strictEqual(t.store['service.yahoo'], undefined);
      refuse = false;
      t.sent.length = 0;
      const [box] = await t.yahoo.collect({signal});
      assert.strictEqual(box.email, 'ann@yahoo.com');
      assert.deepStrictEqual(t.sent.map(r => r.path), ['/', '/ws/v3/batch']);
    }
  }],
  ['mark read: every unread message of the conversation, with the write token', async () => {
    const t = yahoo(req => req.params.name ? res(written('UnifiedUpdateMessage_0')) : undefined);
    await t.yahoo.collect({signal});
    const ok = await t.yahoo.action({cmd: 'rd', email: 'ann@yahoo.com', refs: [{mid: 'm3', mids: ['m1', 'm3']}, {mid: 'm2', mids: ['m2']}], signal});
    assert.strictEqual(ok, true);
    const w = t.sent.at(-1);
    assert.deepStrictEqual(w.params, {name: 'messages.readFlagUpdate', appId: 'YMailNovation', wssid: 'W/ss', nonblocking: 'true'});
    const [r] = w.batch.requests;
    assert.strictEqual(r.method, 'POST');
    assert.ok(decodeURIComponent(r.uri).endsWith('?q=id:(m1 m3 m2)'));
    assert.deepStrictEqual(r.payload, {message: {flags: {read: true}}});
  }],
  ['archive marks read first when asked, then moves to the archive folder', async () => {
    const t = yahoo(req => req.params.name ? res(written('UnifiedUpdateMessage_0')) : undefined);
    await t.yahoo.collect({signal});
    await t.yahoo.action({cmd: 'rc_^i', email: 'ann@yahoo.com', refs: [{mid: 'm2', mids: ['m2']}], prefs: {doReadOnArchive: true}, signal});
    const writes = t.sent.filter(r => r.params.name);
    assert.deepStrictEqual(writes.map(r => r.params.name), ['messages.readFlagUpdate', 'messages.move']);
    assert.deepStrictEqual(writes[1].batch.requests[0].payload, {message: {folder: {id: '21'}}});
  }],
  ['delete and spam move to trash and bulk', async () => {
    const t = yahoo(req => req.params.name ? res(written('UnifiedUpdateMessage_0')) : undefined);
    await t.yahoo.collect({signal});
    await t.yahoo.action({cmd: 'tr', email: 'ann@yahoo.com', refs: [{mid: 'm2'}], signal});
    await t.yahoo.action({cmd: 'sp', email: 'ann@yahoo.com', refs: [{mid: 'm2'}], signal});
    const writes = t.sent.filter(r => r.params.name);
    assert.deepStrictEqual(writes.map(r => r.batch.requests[0].payload.message.folder.id), ['4', '6']);
  }],
  ['the folders are asked for when no check has seen them', async () => {
    const t = yahoo(req => req.params.name ? res(written('UnifiedUpdateMessage_0')) :
      req.batch?.requests.length === 1 ? res({result: {responses: [{id: 'GetFolders', httpCode: 200, response: {result: {folders: FOLDERS}}}]}}) : undefined);
    t.store['service.yahoo'] = {mailboxId: 'MB/1', wssid: 'W/ss', email: 'ann@yahoo.com', folders: {}};
    await t.yahoo.action({cmd: 'tr', email: 'ann@yahoo.com', refs: [{mid: 'm2'}], signal});
    assert.deepStrictEqual(t.sent.at(-1).batch.requests[0].payload, {message: {folder: {id: '4'}}});
  }],
  ['a refused write is an error and the tokens are read again next time', async () => {
    const t = yahoo(req => req.params.name ? res({result: {responses: [{id: 'UnifiedUpdateMessage_0', httpCode: 500, response: {error: {code: 'X'}}}]}}) : undefined);
    await t.yahoo.collect({signal});
    await assert.rejects(t.yahoo.action({cmd: 'rd', email: 'ann@yahoo.com', refs: [{mid: 'm2'}], signal}), /failed/);
    assert.strictEqual(t.store['service.yahoo'], undefined);
  }],
  ['an action for another Yahoo account is refused', async () => {
    const t = yahoo(req => req.params.name ? res(written('UnifiedUpdateMessage_0')) : undefined);
    await t.yahoo.collect({signal});
    await assert.rejects(t.yahoo.action({cmd: 'rd', email: 'bob@yahoo.com', refs: [{mid: 'm2'}], signal}), /another account/);
    assert.strictEqual(t.sent.filter(r => r.params.name).length, 0);
    // the page was asked once more, in case the account had been switched
    assert.strictEqual(t.sent.at(-1).path, '/');
  }],
  ['the reader gets the conversation, oldest first, text bodies escaped', async () => {
    const body = (from, date, b) => ({message: {headers: {from: [{name: from, email: from + '@x.test'}], to: [{email: 'ann@yahoo.com'}], date}}, simpleBody: b});
    const t = yahoo(req => req.params.name === 'messages.getBodies' ? res({result: {responses: [
      {id: 'GetSimpleBody_0', httpCode: 200, response: {result: body('late', 1761907200, {html: '<p>new</p>'})}},
      {id: 'GetSimpleBody_1', httpCode: 200, response: {result: body('early', 1761900000, {text: 'a < b'})}}
    ]}}) : undefined);
    await t.yahoo.collect({signal});
    const out = plain(await t.yahoo.body({email: 'ann@yahoo.com', ref: {mid: 'm3', mids: ['m3', 'm1']}, signal}));
    assert.deepStrictEqual(out.map(m => m.name), ['early', 'late']);
    assert.strictEqual(out[0].html, '<pre>a &lt; b</pre>');
    assert.strictEqual(out[1].html, '<p>new</p>');
    assert.strictEqual(out[1].to, 'ann@yahoo.com');
    assert.ok(t.sent.at(-1).batch.requests[0].uri.endsWith('/messages/@.id==m3/content/simplebody'));
  }],
  ['compose goes through Yahoo\'s mailto handler', () => {
    const t = yahoo();
    const url = new URL(t.yahoo.compose('bo@x.test', 'Re: hi & bye'));
    assert.strictEqual(url.origin + url.pathname, BASE + '/mrd/mail/any/compose');
    assert.strictEqual(url.searchParams.get('url'), 'mailto:bo@x.test?subject=Re%3A%20hi%20%26%20bye');
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
