/*
 * Mail.ru: the internal API of its web client (e.mail.ru), with the browser's own session.
 *
 * Adapted from Pulsar, lib/providers/mailru.ts (Copyright (c) 2026 Ilya Levin, MIT License,
 * https://github.com/ilyachase/pulsar), checked by its author against a live mailbox on
 * 2026-10-11, and from 3MR mailru-notifier 1.5.1, lib/mailapi.js (Copyright (c) 2026 3MR,
 * MIT License, https://github.com/3MR-apps/mailru-notifier).
 *
 *  1. GET portal.mail.ru/NaviData?mac=1: the mailboxes signed in to the session
 *  2. GET e.mail.ru/api/v1/user/short?email=: the mailbox's token, which the rest of the API wants
 *  3. GET e.mail.ru/api/v1/messages/status?folder=0&filters={"unread":true}: the unread inbox mail
 *     and the folders' counters
 *  4. POST e.mail.ru/api/v1/threads/marks and threads/move: mark read, trash, spam
 *  5. GET e.mail.ru/api/v1/messages/message?id=: one message for the reader
 */
{
  const ORIGIN = 'https://e.mail.ru';
  const NAVI = 'https://portal.mail.ru/NaviData?mac=1';
  const KEY = 'service.mailru';
  const MAX = 20;
  const INBOX = '0';
  const TRASH = '500002';
  // the folder the other checkers leave out as spam; a move there is what "spam" does here (inferred)
  const SPAM = '950';

  const api = (path, params) => `${ORIGIN}/api/v1/${path}?${new URLSearchParams({...params, htmlencoded: 'false'})}`;
  // x-email makes the web client switch to that mailbox
  const page = (path, email) => `${ORIGIN}${path}?${new URLSearchParams({'x-email': email})}`;
  // the web client's id of a message in its folder, which the actions take
  const thread = r => `0:${r.id}:${r.folder || INBOX}`;

  // the answer's JSON and its status: the number the API puts in the JSON, or else HTTP's
  const call = async (url, init, signal) => {
    const r = await fetch(url, {...init, credentials: 'include', cache: 'no-store', signal});
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    }
    catch (e) {}
    return {
      json,
      ok: r.ok,
      status: typeof json?.status === 'number' ? json.status : r.status,
      login: r.redirected && String(r.url).startsWith('https://account.mail.ru/')
    };
  };
  const stale = a => a.status === 401 || a.status === 403;
  const fail = (path, a) => Error(path + ': ' + (a.json ? a.json.status ?? a.status : a.ok ? 'not JSON' : 'HTTP ' + a.status));
  const post = (path, form, signal) => call(`${ORIGIN}/api/v1/${path}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json, text/plain, */*'},
    body: new URLSearchParams(form).toString()
  }, signal);

  // session: {tokens: {email: token}}; writes go one after another so parallel mailboxes keep theirs
  const tokens = async () => (await chrome.storage.session.get(KEY))[KEY]?.tokens || {};
  let saving = Promise.resolve();
  const keep = (email, token) => {
    saving = saving.then(async () => {
      const {[KEY]: o = {}} = await chrome.storage.session.get(KEY);
      const all = {...o.tokens};
      if (token) {
        all[email] = token;
      }
      else {
        delete all[email];
      }
      await chrome.storage.session.set({[KEY]: {...o, tokens: all}});
    }).catch(() => {});
    return saving;
  };
  // a new token, or '' when the session no longer has this mailbox (signed out of it elsewhere)
  const fresh = async (email, signal) => {
    const a = await call(api('user/short', {email}), {}, signal);
    const token = a.json?.status === 200 && a.json.body?.token;
    if (typeof token === 'string' && token) {
      await keep(email, token);
      return token;
    }
    // only a refusal, or an answer that is fine but has no token, means the mailbox is gone; an
    // error status in the JSON (500, 429...) is a failure, not a sign-out
    if (a.login || stale(a) || a.json?.status === 'noauth' || (a.ok && a.json?.status === 200)) {
      return '';
    }
    throw fail('user/short', a);
  };
  // send(token) with the mailbox's token; a cached one the API calls stale is replaced once.
  // null: signed out of the mailbox
  const authed = async (email, signal, send) => {
    const cached = (await tokens())[email];
    let token = cached || await fresh(email, signal);
    let a = token ? await send(token) : null;
    if (a && stale(a) && cached) {
      await keep(email, '');
      token = await fresh(email, signal);
      a = token ? await send(token) : null;
    }
    return a;
  };

  // the mailboxes signed in, the active one first: ?mac=1 lists them in data.list, ?ldata=1 as
  // the keys of data.ldata
  const mailboxes = data => {
    const all = [data?.email, ...(Array.isArray(data?.list) ? data.list : []), ...Object.keys(data?.ldata || {})];
    return [...new Set(all.filter(e => typeof e === 'string' && e.includes('@')).map(e => e.trim().toLowerCase()))];
  };
  // the API dates mail in seconds
  const time = date => {
    const n = Number(date) || 0;
    const ms = n < 1e12 ? n * 1000 : n;
    return ms > 0 && ms < 8.64e15 ? ms : 0;
  };
  const entry = (m, t, email) => {
    const id = String(m.id);
    const from = m.correspondents?.from?.[0] || {};
    return {
      id: 'mailru:' + id,
      link: page(`/inbox/0:${encodeURIComponent(id)}:0/`, email),
      ref: {id, folder: String(m.folder ?? INBOX)},
      title: String(m.subject || '').trim(),
      summary: String(m.snippet || '').trim(),
      modified: new Date(t).toISOString(),
      author_name: String(from.name || '').trim(),
      author_email: String(from.email || '').trim().toLowerCase()
    };
  };
  const mailbox = async (email, signal) => {
    const a = await authed(email, signal, token => call(api('messages/status', {
      folder: INBOX,
      limit: String(MAX),
      offset: '0',
      filters: JSON.stringify({unread: true}),
      email,
      token
    }), {}, signal));
    if (!a) {
      return null;
    }
    const body = a.json?.status === 200 ? a.json.body : null;
    if (!Array.isArray(body?.messages)) {
      throw fail('messages/status', a);
    }
    const entries = body.messages.filter(m => m?.id && m.flags?.unread !== false)
      .map(m => [time(m.date), m])
      .sort((x, y) => y[0] - x[0])
      .slice(0, MAX)
      .map(([t, m]) => entry(m, t, email));
    const counter = Number(Object.values(body.folders || {}).find(f => String(f?.id) === INBOX)?.messages_unread);
    return {
      email,
      inbox: page('/inbox/', email),
      unread: Number.isFinite(counter) ? Math.max(counter, entries.length) : entries.length,
      entries
    };
  };

  // The reader's shapes below come from old code only (messages/message: body.body.html/.text,
  // correspondents, attaches.list[].href.download); none of the current sources reads a message.
  const escape = text => text.replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
  const content = part => {
    if (typeof part === 'string') {
      return /<[a-z][^>]*>/i.test(part) ? part : escape(part).replace(/\r?\n/g, '<br>');
    }
    if (typeof part?.html === 'string' && part.html.trim()) {
      return part.html;
    }
    if (typeof part?.text === 'string' && part.text.trim()) {
      return escape(part.text).replace(/\r?\n/g, '<br>');
    }
    return '';
  };
  const people = (...lists) => lists.flatMap(list => Array.isArray(list) ? list : []).map(p => {
    const name = String(p?.name || '').trim();
    const address = String(p?.email || '').trim();
    return name && address && name !== address ? `${name} <${address}>` : name || address;
  }).filter(Boolean).join(', ');
  const files = attaches => (Array.isArray(attaches?.list) ? attaches.list : []).map(f => ({
    name: String(f?.name || ''),
    url: String(f?.href?.download || f?.href?.view || '')
  })).filter(f => f.url.startsWith('https://'));

  const service = {
    id: 'mailru',
    name: 'Mail.ru',
    origins: ['https://portal.mail.ru/*', 'https://e.mail.ru/*'],
    hosts: ['https://e.mail.ru/'],
    signIn: 'https://account.mail.ru/login',
    // no source shows parameters that fill in the recipient or the subject
    compose: () => ORIGIN + '/compose/',
    // no source tells the archive folder's id
    can: {archive: false, spam: true, body: true},
    // Pulsar sends its e.mail.ru API requests with the mail's own Origin and Referer, as the web
    // client does; NaviData?mac=1 works without (3MR, Forge)
    rewrite: [{urlFilter: '||e.mail.ru/api/', origin: ORIGIN}],

    async collect({signal}) {
      const a = await call(NAVI, {}, signal);
      if (a.login || a.status === 401 || a.json?.status === 'noauth') {
        return [];
      }
      if (a.json?.status !== 'ok') {
        throw fail('NaviData', a);
      }
      const boxes = await Promise.all(mailboxes(a.json.data).map(email => mailbox(email, signal)));
      return boxes.filter(Boolean);
    },
    async action({cmd, email, refs, signal}) {
      if (cmd !== 'rd' && cmd !== 'tr' && cmd !== 'sp') {
        throw Error('Not supported: ' + cmd);
      }
      if (refs.length === 0) {
        return true;
      }
      const ids = refs.map(thread);
      // the newest message of each thread: in the inbox list a thread is the message itself
      const last = JSON.stringify(Object.fromEntries(refs.map(r => [thread(r), String(r.id)])));
      // one request for the whole batch: both take arrays of threads (inferred, the sources send one)
      const [path, form] = cmd === 'rd' ? ['threads/marks', {
        marks: JSON.stringify([{name: 'unread', unset: ids, folder: 0}]),
        message_id_last: last
      }] : ['threads/move', {
        ids: JSON.stringify(ids),
        msg_ids: JSON.stringify(refs.map(r => ({id: thread(r), folder: String(r.folder || INBOX)}))),
        folder: cmd === 'tr' ? TRASH : SPAM,
        message_id_last: last
      }];
      const a = await authed(email, signal, token => post(path, {...form, email, htmlencoded: 'false', token}, signal));
      if (!a) {
        throw Error('Signed out of ' + email);
      }
      if (a.json?.status !== 200) {
        throw fail(path, a);
      }
      return true;
    },
    async body({email, ref, signal}) {
      const a = await authed(email, signal, token => call(api('messages/message', {
        id: ref.id,
        folder: ref.folder || INBOX,
        email,
        // the panel reads ahead on hover; "read" is its own action (unverified parameter)
        mark_read: 'false',
        token
      }), {}, signal));
      if (!a) {
        throw Error('Signed out of ' + email);
      }
      const m = a.json?.status === 200 ? a.json.body : null;
      if (!m || typeof m !== 'object') {
        throw fail('messages/message', a);
      }
      const html = content(m.body);
      if (!html) {
        throw Error('messages/message: no body');
      }
      const from = m.correspondents?.from?.[0] || m.replies?.to?.[0] || {};
      const t = time(m.date);
      return [{
        name: String(from.name || '').trim(),
        email: String(from.email || '').trim().toLowerCase(),
        date: t ? new Date(t).toISOString() : '',
        to: people(m.correspondents?.to, m.correspondents?.cc),
        html,
        files: files(m.attaches)
      }];
    }
  };
  (self.MailServices = self.MailServices || {})[service.id] = service;
}
