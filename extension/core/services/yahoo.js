/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// Yahoo Mail through the browser's signed-in session. The page fields, the batch requests, the
// unread query and the write operations are adapted from X-notifier Neo 4.0.8 by Byungwook Kang,
// js/scripts/yahoo.js (MPL-2.0), https://addons.mozilla.org/firefox/addon/xnotifier-neo/
{
  const BASE = 'https://mail.yahoo.com';
  const KEY = 'service.yahoo';
  const APP = 'YMailNovation';
  const MAX = 20;
  // unread mail of the primary account; the inbox filter is applied to the answer
  const QUERY = ' userQuery:("is:unread") acctId:1 groupBy:conversationId count:100 offset:0' +
    ' -folderType:(TRASH)-folderType:(BULK)-folderType:(SYNC)-folderType:(INVISIBLE)';
  const MOVES = {'rc_^i': 'ARCHIVE', 'tr': 'TRASH', 'sp': 'BULK'};

  const kept = async () => (await chrome.storage.session.get(KEY))[KEY] || null;
  const keep = tokens => chrome.storage.session.set({[KEY]: tokens});
  const forget = () => chrome.storage.session.remove(KEY);

  // values in the page are JSON string contents and may hold escapes
  const unjson = s => {
    try {
      return JSON.parse('"' + s + '"');
    }
    catch (e) {
      return s;
    }
  };
  const escape = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
  // dates come in seconds; internalDate may be in milliseconds
  const time = h => {
    let t = Number(h?.date || h?.internalDate) || 0;
    if (t > 0 && t < 1e12) {
      t *= 1000;
    }
    return t;
  };
  const iso = h => new Date(time(h) || Date.now()).toISOString();
  const mailbox = tokens => '/ws/v3/mailboxes/@.id==' + encodeURIComponent(tokens.mailboxId);
  const result = (res, id) => res.responses.find(r => r.id === id)?.response?.result;
  // folders of linked outside accounts carry another acctId; unverified: acctId may be absent
  const primary = f => f.acctId === undefined || String(f.acctId) === '1';
  const byType = folders => {
    const o = {};
    for (const f of folders.filter(primary)) {
      for (const type of f.types || []) {
        o[type] = o[type] || String(f.id);
      }
    }
    // unverified: the ARCHIVE type is seen only in another notifier; the folder's name is the fallback
    const archive = folders.filter(primary).find(f => /^archive$/i.test(f.name || ''));
    if (!o.ARCHIVE && archive) {
      o.ARCHIVE = String(archive.id);
    }
    return o;
  };

  // The Yahoo Mail page carries the mailbox id, the write token (wssid) and the address in its
  // bootstrap data. Signed out, it is a landing page without them.
  const page = async signal => {
    const r = await fetch(BASE + '/', {credentials: 'include', signal});
    if (r.status === 401 || /^https:\/\/(login|guce)\.yahoo\.com\//.test(r.url || '')) {
      return null;
    }
    if (!r.ok) {
      throw Error('yahoo page ' + r.status);
    }
    const html = await r.text();
    const id = html.match(/"selectedMailboxId":"([^"]+)"/);
    if (!id) {
      return null;
    }
    const wssid = html.match(/"mailWssid":"([^"]+)"/);
    const email = html.match(/"accounts".+?"email":"([^"]+)"/) || html.match(/"email":"([^"]+)"/);
    if (!email) {
      throw Error('yahoo page: no address');
    }
    const tokens = {
      mailboxId: unjson(id[1]),
      wssid: wssid ? unjson(wssid[1]) : '',
      email: unjson(email[1]).toLowerCase(),
      folders: {}
    };
    await keep(tokens);
    return tokens;
  };

  // One POST to the batch endpoint. Reads need no query; writes name the operation and carry the
  // wssid. A 400 or 401, outside or for one request inside, means the tokens are stale.
  const batch = async (tokens, requests, {signal, params}) => {
    const body = new FormData();
    body.append('batchJson', JSON.stringify({requests, responseType: 'json'}));
    const url = BASE + '/ws/v3/batch' + (params ? '?' + new URLSearchParams(params) : '');
    const r = await fetch(url, {method: 'POST', body, credentials: 'include', signal});
    if (r.status === 429) {
      throw Error('rate limited');
    }
    if (r.status === 400 || r.status === 401) {
      return {stale: r.status};
    }
    // any other refusal may be of the tokens too (another account signed in, say): the next call
    // reads the page again rather than send them forever
    if (!r.ok) {
      await forget();
      throw Error('yahoo batch ' + r.status);
    }
    const j = await r.json().catch(() => null);
    const responses = j?.result?.responses;
    if (!Array.isArray(responses)) {
      await forget();
      throw Error('yahoo batch: unreadable answer');
    }
    if (responses.some(x => x.httpCode === 429)) {
      throw Error('rate limited');
    }
    const stale = responses.find(x => x.httpCode === 400 || x.httpCode === 401);
    return stale ? {stale: stale.httpCode} : {responses};
  };

  // Runs a batch with the cached tokens, and once more with fresh ones from the page when they
  // are stale. null: signed out.
  // An action or the reader names its mailbox: nothing is sent while Yahoo is signed in to
  // another account.
  const session = async (signal, run, email) => {
    const want = email && String(email).toLowerCase();
    const other = tokens => want && tokens.email !== want;
    let tokens = await kept();
    if (tokens && other(tokens)) {
      await forget();
      tokens = null;
    }
    const cached = Boolean(tokens);
    tokens = tokens || await page(signal);
    if (!tokens) {
      return null;
    }
    if (other(tokens)) {
      throw Error('signed in to Yahoo as another account');
    }
    let res = await run(tokens);
    if (res.stale && cached) {
      await forget();
      tokens = await page(signal);
      if (!tokens) {
        return null;
      }
      if (other(tokens)) {
        throw Error('signed in to Yahoo as another account');
      }
      res = await run(tokens);
    }
    if (res.stale) {
      await forget();
      if (res.stale === 401) {
        return null;
      }
      throw Error('yahoo batch ' + res.stale);
    }
    return {tokens, res};
  };

  const signedIn = async (signal, email, run) => {
    const s = await session(signal, run, email);
    if (!s) {
      throw Error('signed out');
    }
    return s;
  };

  // the folder for a move, from the folders the last check saw, or asked for once
  const folder = async (type, email, signal) => {
    const tokens = await kept();
    if (tokens?.folders?.[type]) {
      return tokens.folders[type];
    }
    const s = await signedIn(signal, email, t => batch(t, [
      {id: 'GetFolders', uri: mailbox(t) + '/folders', method: 'GET'}
    ], {signal}));
    const folders = result(s.res, 'GetFolders')?.folders;
    if (!Array.isArray(folders)) {
      throw Error('yahoo folders: unreadable answer');
    }
    const types = byType(folders);
    await keep({...s.tokens, folders: types});
    if (!types[type]) {
      throw Error('no ' + type.toLowerCase() + ' folder');
    }
    return types[type];
  };

  const write = async (op, mids, payload, email, signal) => {
    const s = await signedIn(signal, email, t => t.wssid ? batch(t, [{
      id: 'UnifiedUpdateMessage_0',
      uri: mailbox(t) + '/messages/@.select==q?q=' + encodeURIComponent('id:(' + mids.join(' ') + ')'),
      method: 'POST',
      payloadType: 'embedded',
      payload
    }], {signal, params: {name: op, appId: APP, wssid: t.wssid, nonblocking: 'true'}}) : {stale: 400});
    const x = s.res.responses.find(r => r.id === 'UnifiedUpdateMessage_0') || s.res.responses[0];
    if (!x || x.httpCode < 200 || x.httpCode >= 300 || x.response?.error) {
      // the page is read again on the next call
      await forget();
      throw Error('yahoo ' + op + ' failed');
    }
  };

  const service = {
    id: 'yahoo',
    name: 'Yahoo Mail',
    origins: ['https://mail.yahoo.com/*'],
    hosts: ['https://mail.yahoo.com/'],
    signIn: 'https://login.yahoo.com/signin?.src=ym&activity=mail-direct&.done=https%3A%2F%2Fmail.yahoo.com%2Fn%2F',
    // Yahoo's own mailto handler; unverified: how it treats a bare "mailto:"
    compose: (to = '', subject = '') => {
      const mailto = 'mailto:' + encodeURIComponent(to).replace(/%40/g, '@').replace(/%2C/gi, ',') +
        (subject ? '?subject=' + encodeURIComponent(subject) : '');
      return BASE + '/mrd/mail/any/compose?src=mailto&url=' + encodeURIComponent(mailto);
    },
    can: {archive: true, spam: true, body: true},
    rewrite: [{urlFilter: '||mail.yahoo.com/ws/', origin: 'https://mail.yahoo.com'}],

    async collect({signal}) {
      const s = await session(signal, t => batch(t, [
        {id: 'GetFolders', uri: mailbox(t) + '/folders', method: 'GET'},
        {id: 'GetMessageGroupList', uri: mailbox(t) + '/messages/@.select==q?q=' + encodeURIComponent(QUERY), method: 'GET'}
      ], {signal}));
      if (!s) {
        return [];
      }
      const folders = result(s.res, 'GetFolders')?.folders;
      const messages = result(s.res, 'GetMessageGroupList')?.messages;
      if (!Array.isArray(folders) || !Array.isArray(messages)) {
        await forget();
        throw Error('yahoo: unreadable answer');
      }
      const types = byType(folders);
      if (JSON.stringify(types) !== JSON.stringify(s.tokens.folders || {})) {
        await keep({...s.tokens, folders: types});
      }
      // one entry per conversation, shown by its newest unread message
      const threads = new Map();
      for (const m of messages) {
        if (!m?.id || m.flags?.read === true || !(m.folder?.types || []).includes('INBOX')) {
          continue;
        }
        const cid = m.conversationId || m.id;
        const t = threads.get(cid);
        if (t) {
          t.mids.push(m.id);
          if (time(m.headers) > time(t.m.headers)) {
            t.m = m;
          }
        }
        else {
          threads.set(cid, {cid, m, mids: [m.id]});
        }
      }
      const entries = [...threads.values()]
        .sort((a, b) => time(b.m.headers) - time(a.m.headers))
        .slice(0, MAX)
        .map(({cid, m, mids}) => {
          const h = m.headers || {};
          const from = (h.from || [])[0] || {};
          return {
            id: 'yahoo:' + m.id,
            link: BASE + '/n/folders/' + encodeURIComponent(m.folder.id) + '/messages/' + encodeURIComponent(cid),
            ref: {mid: m.id, cid, mids},
            title: h.subject || '',
            summary: m.snippet || '',
            modified: iso(h),
            author_name: from.name || '',
            author_email: from.email || ''
          };
        });
      const inboxes = folders.filter(f => primary(f) && (f.types || []).includes('INBOX'));
      // should the folder types change, the listed mail is the best count left
      const unread = inboxes.length ? inboxes.reduce((n, f) => n + (Number(f.unread) || 0), 0) : threads.size;
      return [{email: s.tokens.email, inbox: BASE + '/n/folders/1', unread, entries}];
    },

    async action({cmd, email, refs, prefs = {}, signal}) {
      const mids = [...new Set((refs || []).flatMap(r => r?.mids || [r?.mid]).filter(Boolean))];
      if (mids.length === 0) {
        throw Error('no messages');
      }
      const type = MOVES[cmd];
      if (!type && cmd !== 'rd') {
        throw Error('unknown command ' + cmd);
      }
      if (cmd === 'rd' || (cmd === 'rc_^i' && prefs.doReadOnArchive)) {
        await write('messages.readFlagUpdate', mids, {message: {flags: {read: true}}}, email, signal);
      }
      if (type) {
        const id = await folder(type, email, signal);
        await write('messages.move', mids, {message: {folder: {id}}}, email, signal);
      }
      return true;
    },

    // Unverified shape: the result of a simplebody request is {message: {headers}, simpleBody: {html}}
    // (seen only in unlicensed code, read for knowledge). Only the unread messages of the
    // conversation are known here, so those are what the reader shows; attachments are not listed.
    async body({email, ref, signal}) {
      const mids = ref?.mids || [ref?.mid].filter(Boolean);
      if (mids.length === 0) {
        throw Error('no messages');
      }
      const s = await signedIn(signal, email, t => batch(t, mids.map((mid, i) => ({
        id: 'GetSimpleBody_' + i,
        uri: mailbox(t) + '/messages/@.id==' + encodeURIComponent(mid) + '/content/simplebody',
        method: 'GET',
        payloadType: 'embedded'
      })), {signal, params: t.wssid ? {name: 'messages.getBodies', appId: APP, wssid: t.wssid} : undefined}));
      const out = mids.map((mid, i) => result(s.res, 'GetSimpleBody_' + i)).filter(Boolean).map(r => {
        const h = r.message?.headers || {};
        const from = (h.from || [])[0] || {};
        const b = r.simpleBody || {};
        return {
          name: from.name || '',
          email: from.email || '',
          date: iso(h),
          to: (h.to || []).map(a => a.email).filter(Boolean).join(', '),
          html: b.html || (b.text ? '<pre>' + escape(b.text) + '</pre>' : ''),
          files: []
        };
      });
      if (out.length === 0) {
        throw Error('yahoo: no message body');
      }
      return out.sort((a, b) => a.date.localeCompare(b.date));
    }
  };
  (self.MailServices = self.MailServices || {})[service.id] = service;
}
