/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
// AOL Mail through the browser's signed-in session. AOL runs on Yahoo's mail platform. The page
// field, the mailboxes call, the batch requests and the write operations are adapted from
// X-notifier Neo 4.0.8 by Byungwook Kang, js/scripts/aol.js (MPL-2.0),
// https://addons.mozilla.org/firefox/addon/xnotifier-neo/
{
  const BASE = 'https://mail.aol.com';
  const KEY = 'service.aol';
  const APP = 'aolwebmail';
  const MAX = 20;
  // the newest 100 inbox messages; read ones are dropped from the answer
  const LIST = '/messages/@.select==q?&q=folderId%3A1%20offset%3A0%20count%3A100%20sort%3A(-date)';
  const MOVES = {'rc_^i': 'ARCHIVE', 'tr': 'TRASH', 'sp': 'BULK'};

  const kept = async () => (await chrome.storage.session.get(KEY))[KEY] || null;
  const keep = tokens => chrome.storage.session.set({[KEY]: tokens});
  const forget = () => chrome.storage.session.remove(KEY);

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
  const mailbox = tokens => '/ws/v3/mailboxes/@.id==' + tokens.mailboxId;
  const result = (res, id, i) => (res.responses.find(r => r.id === id) || res.responses[i])?.response?.result;
  const primary = f => f.acctId === undefined || String(f.acctId) === '1';
  const byType = folders => {
    const o = {};
    for (const f of folders.filter(primary)) {
      for (const type of f.types || []) {
        o[type] = o[type] || String(f.id);
      }
    }
    // unverified for AOL: an ARCHIVE folder type; the folder's name is the fallback
    const archive = folders.filter(primary).find(f => /^archive$/i.test(f.name || ''));
    if (!o.ARCHIVE && archive) {
      o.ARCHIVE = String(archive.id);
    }
    return o;
  };
  // AOL's inbox is folder 1, named Inbox (NewMail on old accounts)
  const isInbox = f => (f.types || []).includes('INBOX') || /^(inbox|newmail)$/i.test(f.name || '');

  // The page gives a request id (guidHash); the mailboxes call then gives the mailbox id, the
  // wssid and the address. Signed out, the page has no guidHash and the call answers 401.
  const page = async signal => {
    const r = await fetch(BASE + '/', {credentials: 'include', signal});
    if (r.status === 401 || /^https:\/\/(login|oidc\.mail|guce)\.aol\.com\//.test(r.url || '')) {
      return null;
    }
    if (!r.ok) {
      throw Error('aol page ' + r.status);
    }
    const g = (await r.text()).match(/"guidHash"\s*:\s*"(\S+?)"/);
    if (!g) {
      return null;
    }
    const ymreqid = g[1];
    const m = await fetch(BASE + '/ws/v3/mailboxes?' + new URLSearchParams({appid: APP, ymreqid}), {
      credentials: 'include',
      signal
    });
    if (m.status === 401) {
      return null;
    }
    if (m.status === 429) {
      throw Error('rate limited');
    }
    if (!m.ok) {
      throw Error('aol mailboxes ' + m.status);
    }
    const text = await m.text();
    let j;
    try {
      j = JSON.parse(text);
    }
    catch (e) {
      throw Error('aol mailboxes: unreadable answer');
    }
    const id = j?.result?.mailboxes?.[0]?.id;
    if (!id) {
      return null;
    }
    // where the wssid and the address sit in this answer is not known, so they are searched for
    const wssid = text.match(/"wssid":"(\S+?)"/);
    const email = text.match(/"email":"(\S+?)"/);
    if (!wssid || !email) {
      throw Error('aol mailboxes: no ' + (wssid ? 'address' : 'wssid'));
    }
    const tokens = {ymreqid, mailboxId: String(id), wssid: unjson(wssid[1]), email: unjson(email[1]).toLowerCase(), folders: {}};
    await keep(tokens);
    return tokens;
  };

  // One POST to the batch endpoint, every call with the wssid. A 400 or 401, outside or for one
  // request inside, means the tokens are stale.
  const batch = async (tokens, requests, {signal, params = {}}) => {
    const url = BASE + '/ws/v3/batch?' + new URLSearchParams({
      appid: APP, ymreqid: tokens.ymreqid, webstdver: '95.0', wssid: tokens.wssid, ...params
    });
    const r = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      signal,
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({responseType: 'json', requests})
    });
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
      throw Error('aol batch ' + r.status);
    }
    const j = await r.json().catch(() => null);
    const responses = j?.result?.responses;
    if (!Array.isArray(responses)) {
      await forget();
      throw Error('aol batch: unreadable answer');
    }
    if (responses.some(x => x.httpCode === 429)) {
      throw Error('rate limited');
    }
    const stale = responses.find(x => x.httpCode === 400 || x.httpCode === 401);
    return stale ? {stale: stale.httpCode} : {responses};
  };

  // Runs a batch with the cached tokens, and once more with fresh ones when they are stale.
  // null: signed out.
  // An action or the reader names its mailbox: nothing is sent while AOL is signed in to
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
      throw Error('signed in to AOL as another account');
    }
    let res = await run(tokens);
    if (res.stale && cached) {
      await forget();
      tokens = await page(signal);
      if (!tokens) {
        return null;
      }
      if (other(tokens)) {
        throw Error('signed in to AOL as another account');
      }
      res = await run(tokens);
    }
    if (res.stale) {
      await forget();
      if (res.stale === 401) {
        return null;
      }
      throw Error('aol batch ' + res.stale);
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

  const folder = async (type, email, signal) => {
    const tokens = await kept();
    if (tokens?.folders?.[type]) {
      return tokens.folders[type];
    }
    const s = await signedIn(signal, email, t => batch(t, [
      {id: 'ListFolders', uri: mailbox(t) + '/folders', method: 'GET'}
    ], {signal}));
    const folders = result(s.res, 'ListFolders', 0)?.folders;
    if (!Array.isArray(folders)) {
      throw Error('aol folders: unreadable answer');
    }
    const types = byType(folders);
    await keep({...s.tokens, folders: types});
    if (!types[type]) {
      throw Error('no ' + type.toLowerCase() + ' folder');
    }
    return types[type];
  };

  const write = async (op, mids, payload, email, signal) => {
    const s = await signedIn(signal, email, t => batch(t, [{
      id: 'UpdateMessage',
      uri: mailbox(t) + '/messages/@.select==q?q=' + encodeURIComponent('id:(' + mids.join(' ') + ')'),
      method: 'POST',
      payloadType: 'embedded',
      payload
    }], {signal, params: {name: op, nonblocking: 'true'}}));
    const x = s.res.responses.find(r => r.id === 'UpdateMessage') || s.res.responses[0];
    if (!x || x.httpCode < 200 || x.httpCode >= 300 || x.response?.error) {
      await forget();
      throw Error('aol ' + op + ' failed');
    }
  };

  const service = {
    id: 'aol',
    name: 'AOL Mail',
    origins: ['https://mail.aol.com/*'],
    hosts: ['https://mail.aol.com/'],
    signIn: 'https://oidc.mail.aol.com/login?.src=aolm&activity=header-signin&dest=https%3A%2F%2Fmail.aol.com%2Fd',
    // the same mailto handler as Yahoo's, reported by users; unverified: how it treats a bare "mailto:"
    compose: (to = '', subject = '') => {
      const mailto = 'mailto:' + encodeURIComponent(to).replace(/%40/g, '@').replace(/%2C/gi, ',') +
        (subject ? '?subject=' + encodeURIComponent(subject) : '');
      return BASE + '/mrd/mail/any/compose?src=mailto&url=' + encodeURIComponent(mailto);
    },
    can: {archive: true, spam: true, body: true},
    rewrite: [{urlFilter: '||mail.aol.com/ws/', origin: 'https://mail.aol.com'}],

    async collect({signal}) {
      const s = await session(signal, t => batch(t, [
        {id: 'ListFolders', uri: mailbox(t) + '/folders', method: 'GET'},
        {id: 'ListMessages1', uri: mailbox(t) + LIST, method: 'GET'}
      ], {signal}));
      if (!s) {
        return [];
      }
      const folders = result(s.res, 'ListFolders', 0)?.folders;
      const messages = result(s.res, 'ListMessages1', 1)?.messages;
      if (!Array.isArray(folders) || !Array.isArray(messages)) {
        await forget();
        throw Error('aol: unreadable answer');
      }
      const types = byType(folders);
      if (JSON.stringify(types) !== JSON.stringify(s.tokens.folders || {})) {
        await keep({...s.tokens, folders: types});
      }
      // one entry per conversation, shown by its newest unread message
      const threads = new Map();
      for (const m of messages) {
        if (!m?.id || m.flags?.read === true) {
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
            id: 'aol:' + m.id,
            link: BASE + '/d/folders/' + encodeURIComponent(m.folder?.id || '1') + '/messages/' + encodeURIComponent(m.id),
            ref: {mid: m.id, cid, mids},
            title: h.subject || '',
            summary: m.snippet || '',
            modified: iso(h),
            author_name: from.name || '',
            author_email: from.email || ''
          };
        });
      const inboxes = folders.filter(f => primary(f) && isInbox(f));
      const unread = inboxes.length ? inboxes.reduce((n, f) => n + (Number(f.unread) || 0), 0) : threads.size;
      return [{email: s.tokens.email, inbox: BASE + '/d/folders/1', unread, entries}];
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

    // Unverified for AOL: the simplebody request is known from Yahoo only, and its result shape
    // {message: {headers}, simpleBody: {html}} from unlicensed code read for knowledge. Only the
    // unread messages of the conversation are known here; attachments are not listed.
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
      })), {signal, params: {name: 'messages.getBodies'}}));
      const out = mids.map((mid, i) => result(s.res, 'GetSimpleBody_' + i, -1)).filter(Boolean).map(r => {
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
        throw Error('aol: no message body');
      }
      return out.sort((a, b) => a.date.localeCompare(b.date));
    }
  };
  (self.MailServices = self.MailServices || {})[service.id] = service;
}
