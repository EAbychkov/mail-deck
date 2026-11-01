/*
 * Yandex Mail (and Yandex 360) through the browser's own signed-in session, the
 * same internal web API the mail web interface uses. No password, no OAuth.
 *
 * Adapted from two permissively licensed references:
 *   - pulsar, lib/providers/yandex.ts (MIT, Ilya Levin, 2026-10)
 *     https://github.com/ilyachase/pulsar  -- account list, ckey-from-page, the
 *     messages + app-badge-counter call, link shapes.
 *   - yandex-mail-proxy (Apache-2.0, Sergey Krashevich, 2026-09)
 *     https://github.com/skrashevich/yandex-mail-proxy  -- the do-messages write
 *     shape (mark/unmark/delete/tospam, movefile) and the .eml source URL.
 * The MIME parser below was written for this file; its approach follows
 * postal-mime (MIT-0, Andris Reinman). No GPL or Yandex-owned code was copied,
 * and no OAuth token is ever minted.
 *
 * VERIFIED vs INFERRED is noted per spot. "Verified" = seen in reference source,
 * recorded live traffic, or Chrome docs; "inferred" = reasoned, untested.
 */
{
  // Personal mailboxes live on mail.yandex.ru; Yandex 360 (organization) ones on
  // mail.360.yandex.ru. The wrong host redirects, so we detect it by trying both.
  // VERIFIED (pulsar). mail.yandex.com is left out: no source shows which accounts
  // land there, and the contract says to keep origins to what we actually request.
  const HOSTS = ['mail.yandex.ru', 'mail.360.yandex.ru'];
  const PASSPORT = 'https://api.passport.yandex.ru/accounts';
  const SESSION_KEY = 'service.yandex';

  // ---- small session cache: uid -> {host, ckey, email, folders, src} ----
  const loadStore = async () => {
    const got = await chrome.storage.session.get(SESSION_KEY);
    return got[SESSION_KEY] || {};
  };
  const saveStore = store => chrome.storage.session.set({[SESSION_KEY]: store});
  // one write after another: accounts read in parallel would otherwise save over each other's
  let saving = Promise.resolve();
  const patchAccount = (uid, patch) => {
    const run = saving.then(async () => {
      const store = await loadStore();
      store[uid] = {...(store[uid] || {}), ...patch};
      await saveStore(store);
      return store[uid];
    });
    saving = run.catch(() => {});
    return run;
  };

  // seconds -> ms, just in case; a string or an out-of-range value would make an Invalid Date
  const toMs = ts => {
    const n = Number(ts) || 0;
    const ms = n > 0 && n < 1e12 ? n * 1000 : n;
    return ms > 0 && ms < 8.64e15 ? ms : 0;
  };

  // ---- the ckey + uid + email scraped from a mailbox page ----
  const parsePage = html => {
    const ckey = html.match(/"ckey":"([^"]+)"/);
    const uid = html.match(/"uid":"(\d+)"/);
    if (!ckey || !uid) {
      return null;
    }
    const email = html.match(/"default_email":"([^"]+)"/);
    return {
      ckey: JSON.parse(`"${ckey[1]}"`), // the value is JSON-escaped in the page (e.g. /)
      uid: uid[1],
      email: email ? email[1] : ''
    };
  };

  // GET https://{host}/?uid={uid} without following the redirect: signed out or
  // the wrong host answers with an opaque redirect (empty body, no ckey), which
  // we also have no permission to follow. VERIFIED (pulsar loadSession).
  const fetchPage = async (host, uid, signal) => {
    const res = await fetch(`https://${host}/?uid=${encodeURIComponent(uid)}`, {
      credentials: 'include',
      cache: 'no-store',
      redirect: 'manual',
      signal
    });
    if (res.type === 'opaqueredirect' || res.status === 0 || (res.status >= 300 && res.status < 400)) {
      return null;
    }
    // a server error is not a sign-out: thrown, the check keeps the last answer
    if (res.status >= 500 || res.status === 429) {
      throw new Error(`Yandex page HTTP ${res.status}`);
    }
    if (!res.ok) {
      return null;
    }
    const page = parsePage(await res.text());
    if (!page || page.uid !== String(uid)) {
      return null; // never act on a page that is not this account's
    }
    return page;
  };

  // The ckey of one account, from cache or by reading the page once.
  const ensureCkey = async (uid, host, signal, force) => {
    if (!force) {
      const store = await loadStore();
      const acc = store[uid];
      if (acc && acc.ckey && acc.host === host) {
        return acc;
      }
    }
    const page = await fetchPage(host, uid, signal);
    if (!page) {
      return null;
    }
    return patchAccount(uid, {host, ckey: page.ckey, email: page.email});
  };

  // ---- the liza1 model transport (JSON body, the current web client's shape) ----
  const callModels = async (host, uid, ckey, calls, signal) => {
    const names = calls.map(c => c.name).join(',');
    const payload = {
      models: calls.map(c => ({name: c.name, params: c.params || {}, meta: {requestAttempt: 1}})),
      _ckey: ckey,
      _uid: uid,
      _locale: 'ru'
    };
    const res = await fetch(`https://${host}/web-api/models/liza1?_m=${encodeURIComponent(names)}`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      signal,
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error(`Yandex liza1 HTTP ${res.status}`);
    }
    return res.json();
  };

  const models = json => (json && Array.isArray(json.models) ? json.models : []).filter(Boolean);
  const getModel = (json, name) => models(json).find(m => m.name === name);
  // A stale or foreign ckey comes back as status "error", error "ckey". VERIFIED
  // (pulsar, yandex-mail-proxy).
  const isCkeyError = json => models(json).some(m => m.error === 'ckey');

  // Run a models call for one account, refreshing the ckey once if it is stale.
  // {json, acc}: the answer and the account as cached; null: the page did not resolve here.
  const callForAccount = async (uid, host, calls, signal) => {
    let acc = await ensureCkey(uid, host, signal, false);
    if (!acc) {
      return null;
    }
    let json = await callModels(host, uid, acc.ckey, calls, signal);
    if (isCkeyError(json)) {
      acc = await ensureCkey(uid, host, signal, true);
      if (!acc) {
        return null;
      }
      json = await callModels(host, uid, acc.ckey, calls, signal);
    }
    return {json, acc};
  };

  // ---- accounts signed in to the browser session, default first ----
  // VERIFIED (pulsar listPassportAccounts). 401/403 or a login redirect => signed
  // out, and so is the live answer without a session: 200 with {} (seen 2026-10-31).
  // A network failure or an unreadable answer throws, per the contract.
  const passportAccounts = async signal => {
    const res = await fetch(PASSPORT, {credentials: 'include', cache: 'no-store', redirect: 'manual', signal});
    if (res.status === 401 || res.status === 403 || res.status === 0 || res.type === 'opaqueredirect') {
      return [];
    }
    if (!res.ok) {
      throw new Error(`Yandex passport HTTP ${res.status}`);
    }
    const json = await res.json();
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new Error('Yandex passport: unreadable answer');
    }
    if (!Array.isArray(json.accounts)) {
      return [];
    }
    const def = String(json.default_uid != null ? json.default_uid : '');
    return json.accounts
      .filter(a => a && (typeof a.uid === 'string' || typeof a.uid === 'number'))
      .map(a => ({uid: String(a.uid), email: String(a.defaultEmail || a.login || '').toLowerCase()}))
      .sort((x, y) => Number(y.uid === def) - Number(x.uid === def));
  };

  const inboxLink = (host, uid) => `https://${host}/?uid=${uid}#/inbox`;
  const messageLink = (host, uid, mid) => `https://${host}/?uid=${uid}#/message/${mid}`;

  // Read one mailbox: find its host, then the unread inbox list + the counter in a
  // single liza1 call. current_folder "1" is the inbox; extra_cond only_new keeps
  // unread only; no threading so mid stays the plain message id. VERIFIED (pulsar;
  // the response shape from a recorded session in KonstantinDenisov/LoadRunner).
  const readMailbox = async (acc, signal) => {
    const store = await loadStore();
    const known = store[acc.uid] && store[acc.uid].host;
    const order = known ? [known, ...HOSTS.filter(h => h !== known)] : HOSTS;

    for (const host of order) {
      const got = await callForAccount(acc.uid, host, [
        {name: 'messages', params: {current_folder: '1', first: 0, last: 20, sort_type: 'date', extra_cond: 'only_new'}},
        {name: 'app-badge-counter', params: {}}
      ], signal);
      if (!got) {
        continue; // page would not resolve on this host: try the next
      }
      const {json} = got;
      const list = getModel(json, 'messages');
      // the page resolved on this host, so an error here is this mailbox's, not the host's
      if (!list || list.status !== 'ok') {
        throw new Error(`Yandex messages: ${(list && (list.error || list.status)) || 'no answer'}`);
      }

      // the address of the page just read, the same on every check
      const email = got.acc.email || acc.email;
      const raw = (Array.isArray(list.data && list.data.message) ? list.data.message : [])
        .filter(m => m && m.new && m.mid).slice(0, 20);
      const entries = raw.map(m => {
        const from = (Array.isArray(m.field) ? m.field : []).find(f => f && f.type === 'from') || {};
        return {
          id: `yandex:${acc.uid}:${m.mid}`,
          link: messageLink(host, acc.uid, m.mid),
          ref: {uid: acc.uid, host, mid: String(m.mid), fid: String(m.fid || '1'), tid: m.tid ? String(m.tid) : ''},
          title: (m.subject || '').trim(),
          summary: (m.firstline || '').trim(),
          modified: new Date(toMs(m.date && m.date.timestamp)).toISOString(),
          author_name: from.name || from.email || '',
          author_email: (from.email || '').toLowerCase()
        };
      });

      const counter = getModel(json, 'app-badge-counter');
      const unread = counter && counter.status === 'ok' && counter.data && counter.data.counters
        ? counter.data.counters.unread : undefined;

      return {
        email: String(email).toLowerCase(),
        inbox: inboxLink(host, acc.uid),
        unread: typeof unread === 'number' ? Math.max(unread, entries.length) : entries.length,
        entries
      };
    }
    return null; // signed out of this account, or no host served it
  };

  // ---- folder ids, needed only for trash/spam moves; read once and cached ----
  // Folders model returns {fid, symbol}; inbox/sent/trash/spam/draft... VERIFIED
  // (recorded session: symbol "trash" fid 3, "spam" fid 2).
  const ensureFolders = async (uid, host, signal) => {
    const store = await loadStore();
    if (store[uid] && store[uid].folders) {
      return store[uid].folders;
    }
    const got = await callForAccount(uid, host, [{name: 'folders', params: {}}], signal);
    const model = got && getModel(got.json, 'folders');
    if (!model || model.status !== 'ok') {
      throw new Error('Yandex: could not read the folder list');
    }
    const list = (model.data && model.data.folder) || [];
    const bySymbol = {};
    for (const f of list) {
      if (f && f.symbol && f.fid != null) {
        bySymbol[f.symbol] = String(f.fid);
      }
    }
    const folders = {trash: bySymbol.trash, spam: bySymbol.spam, archive: bySymbol.archive};
    await patchAccount(uid, {folders});
    return folders;
  };

  // ---- do-messages: the one write model the web client uses. VERIFIED mark /
  // unmark / delete / tospam captured live (yandex-mail-proxy). ids is a bare
  // string for one message, an array for several. ----
  const doMessages = async (uid, host, params, signal) => {
    let acc = await ensureCkey(uid, host, signal, false);
    if (!acc) {
      throw new Error('Yandex: not signed in');
    }
    const run = ckey => callModels(host, uid, ckey, [{name: 'do-messages', params}], signal);
    let json = await run(acc.ckey);
    if (isCkeyError(json)) {
      acc = await ensureCkey(uid, host, signal, true);
      if (!acc) {
        throw new Error('Yandex: not signed in');
      }
      json = await run(acc.ckey);
    }
    const model = getModel(json, 'do-messages');
    const ok = model && model.status === 'ok' &&
      (!model.data || model.data.result === undefined || model.data.result === 'ok');
    if (!ok) {
      throw new Error(`Yandex do-messages ${(model && (model.error || model.status)) || 'failed'}`);
    }
    return true;
  };

  // ====================== MIME parser (service-worker safe) ======================
  // Forgiving, as atob is not: padding inside the text (lines encoded one by one) starts a new
  // chunk, and a stray last character of a chunk is dropped rather than thrown on.
  const decodeBase64 = s => {
    const chunks = s.replace(/[^A-Za-z0-9+/=]/g, '').split(/=+/).filter(Boolean);
    const bins = chunks.map(c => atob(c.length % 4 === 1 ? c.slice(0, -1) : c));
    const out = new Uint8Array(bins.reduce((n, b) => n + b.length, 0));
    let at = 0;
    for (const bin of bins) {
      for (let i = 0; i < bin.length; i += 1) {
        out[at++] = bin.charCodeAt(i);
      }
    }
    return out;
  };
  const decodeQuotedPrintable = s => {
    // whitespace at a line's end was added on the way (RFC 2045), then soft line breaks
    const text = s.replace(/[ \t]+(?=\r?\n)/g, '').replace(/=\r?\n/g, '');
    const out = [];
    for (let i = 0; i < text.length; i += 1) {
      if (text[i] === '=' && i + 2 < text.length && /[0-9A-Fa-f]{2}/.test(text.slice(i + 1, i + 3))) {
        out.push(parseInt(text.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        out.push(text.charCodeAt(i) & 0xff);
      }
    }
    return new Uint8Array(out);
  };
  const latinBytes = s => {
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i += 1) {
      out[i] = s.charCodeAt(i) & 0xff;
    }
    return out;
  };
  const decodeText = (bytes, charset) => {
    try {
      return new TextDecoder(charset || 'utf-8', {fatal: false}).decode(bytes);
    } catch (e) {
      return new TextDecoder('utf-8', {fatal: false}).decode(bytes); // unknown label
    }
  };

  // RFC 2047 encoded-words in header values (=?charset?B/Q?...?=). The whitespace between two
  // words goes, and the bytes of adjacent words in one charset are decoded together, since an
  // encoder may split a character between them. A charset may carry a *language (RFC 2231).
  const WORD = /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g;
  const decodeWords = value => value
    .replace(/(=\?[^?]+\?[BbQq]\?[^?]*\?=)\s+(?==\?[^?]+\?[BbQq]\?[^?]*\?=)/g, '$1')
    .replace(/(?:=\?[^?]+\?[BbQq]\?[^?]*\?=)+/g, run => {
      let out = '';
      let charset = null;
      let bytes = [];
      const flush = () => {
        if (bytes.length) {
          out += decodeText(Uint8Array.from(bytes), charset);
        }
        bytes = [];
      };
      for (const [, cs, enc, data] of run.matchAll(WORD)) {
        const c = cs.toLowerCase().split('*')[0];
        if (c !== charset) {
          flush();
          charset = c;
        }
        const b = enc.toUpperCase() === 'B' ? decodeBase64(data) : decodeQuotedPrintable(data.replace(/_/g, ' '));
        for (let i = 0; i < b.length; i += 1) {
          bytes.push(b[i]);
        }
      }
      flush();
      return out;
    });

  const parseHeaders = block => {
    const unfolded = block.replace(/\r?\n[ \t]+/g, ' ');
    const headers = {};
    for (const line of unfolded.split(/\r?\n/)) {
      const m = line.match(/^([^:]+):\s?([\s\S]*)$/);
      if (m) {
        headers[m[1].toLowerCase()] = m[2];
      }
    }
    return headers;
  };
  const headerParams = value => {
    const out = {value: (value || '').split(';')[0].trim().toLowerCase(), params: {}};
    const re = /;\s*([^=;]+)=\s*(?:"([^"]*)"|([^;]*))/g;
    let m;
    while ((m = re.exec(value || ''))) {
      out.params[m[1].trim().toLowerCase()] = (m[2] !== undefined ? m[2] : m[3] || '').trim();
    }
    return out;
  };

  const splitParts = (body, boundary) => {
    const parts = [];
    const segs = body.split('--' + boundary);
    for (const seg of segs.slice(1)) {
      if (seg.startsWith('--')) {
        break; // closing delimiter
      }
      parts.push(seg.replace(/^\r?\n/, '').replace(/\r?\n$/, ''));
    }
    return parts;
  };

  // part is a latin1 (byte-preserving) string. Returns a tree of nodes; leaves
  // carry decoded text or an attachment name.
  const parsePart = part => {
    const split = part.search(/\r?\n\r?\n/);
    const headerBlock = split === -1 ? part : part.slice(0, split);
    const body = split === -1 ? '' : part.slice(split).replace(/^\r?\n\r?\n/, '');
    const headers = parseHeaders(headerBlock);
    const ctype = headerParams(headers['content-type'] || 'text/plain');
    const disp = headerParams(headers['content-disposition'] || '');
    const cte = (headers['content-transfer-encoding'] || '').trim().toLowerCase();

    if (ctype.value.startsWith('multipart/') && ctype.params.boundary) {
      return {
        multipart: ctype.value.slice('multipart/'.length),
        children: splitParts(body, ctype.params.boundary).map(parsePart)
      };
    }

    const filename = disp.params.filename || ctype.params.name || '';
    const isAttachment = disp.value === 'attachment' ||
      (!ctype.value.startsWith('text/') && !!filename);
    // only a body is decoded: an attachment's bytes are never shown, and may be large
    const shown = ctype.value.startsWith('text/') && !isAttachment;
    const bytes = !shown ? null
      : cte === 'base64' ? decodeBase64(body)
        : cte === 'quoted-printable' ? decodeQuotedPrintable(body)
          : latinBytes(body);
    return {
      type: ctype.value,
      charset: ctype.params.charset,
      filename,
      isAttachment,
      // drop the single trailing CRLF the transport adds, so a body does not gain a stray line
      text: shown ? decodeText(bytes, (ctype.params.charset || 'utf-8').toLowerCase()).replace(/\r?\n$/, '') : ''
    };
  };

  const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const textToHtml = s => escapeHtml(s).replace(/\r?\n/g, '<br>');

  // Walk the tree depth-first, collecting body candidates and attachments.
  const walkLeaves = (node, html, text, files) => {
    if (node.multipart) {
      for (const child of node.children) {
        walkLeaves(child, html, text, files);
      }
      return;
    }
    if (node.isAttachment) {
      if (node.filename) {
        files.push({name: node.filename, url: ''}); // attachment bytes are inline in the .eml; no stable URL
      }
      return;
    }
    if (node.type === 'text/html' && !html.v) {
      html.v = node.text;
    } else if (node.type === 'text/plain' && !text.v) {
      text.v = node.text;
    }
  };

  // bytes: the raw .eml as a Uint8Array. Returns one message object for the panel.
  const parseEml = bytes => {
    // byte for byte, in chunks (TextDecoder's latin1 is windows-1252, which is not)
    let raw = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      raw += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    const tree = parsePart(raw);
    const html = {v: ''};
    const text = {v: ''};
    const files = [];
    walkLeaves(tree, html, text, files);

    const split = raw.search(/\r?\n\r?\n/);
    const headers = parseHeaders(split === -1 ? raw : raw.slice(0, split));
    const from = decodeWords(headers.from || '');
    const name = (from.match(/^\s*"?([^"<]*?)"?\s*</) || [])[1] || '';
    const email = ((from.match(/<([^>]+)>/) || [])[1] || from).trim().toLowerCase();
    const date = headers.date ? new Date(headers.date) : null;

    return {
      name: name.trim() || email,
      email,
      date: date && !isNaN(date) ? date.toISOString() : '',
      to: decodeWords(headers.to || ''),
      html: html.v || (text.v ? textToHtml(text.v) : ''),
      files
    };
  };

  // ---- the "download original" .eml URL. INFERRED: yandex-mail-proxy reports the
  // download works but not which template matched, so we try its candidates in
  // order and cache the one that returns an RFC822 message. ----
  const SOURCE_TEMPLATES = [
    'https://{host}/web-api/message-source/liza1/{uid}/{mid}/yandex_email.eml',
    'https://{host}/message_source/{mid}?_uid={uid}&name=message.eml',
    'https://{host}/message_source/{mid}'
  ];
  const fillTemplate = (tmpl, host, uid, mid) =>
    tmpl.replace('{host}', host).replace('{uid}', uid).replace('{mid}', mid);
  const looksRfc822 = text => /^(received|return-path|delivered-to|from|to|subject|date|message-id):/im.test(text.slice(0, 4096));

  const service = {
    id: 'yandex',
    name: 'Yandex Mail',
    // VERIFIED hosts; passport is requested by collect/action, the mail hosts by
    // everything else. Nothing speculative.
    origins: ['https://mail.yandex.ru/*', 'https://mail.360.yandex.ru/*', 'https://api.passport.yandex.ru/*'],
    hosts: ['https://mail.yandex.ru/', 'https://mail.360.yandex.ru/'],
    signIn: 'https://passport.yandex.ru/auth?retpath=https%3A%2F%2Fmail.yandex.ru%2F',
    // A POST from the worker carries Origin: chrome-extension://...; a 2017-era
    // comment (ivantsov) and pulsar both set the mail origin on the write calls.
    // One rule per mail host, each with its own origin. VERIFIED (pulsar).
    compose: () => 'https://mail.yandex.ru/#compose', // to/subject param shape unverified, so plain compose
    can: {
      archive: false, // the archive move shape could not be verified; see ensureFolders/action
      spam: true,
      body: true
    },
    rewrite: [
      {urlFilter: '||mail.yandex.ru/web-api', origin: 'https://mail.yandex.ru'},
      {urlFilter: '||mail.360.yandex.ru/web-api', origin: 'https://mail.360.yandex.ru'}
    ],

    async collect({signal}) {
      const accounts = await passportAccounts(signal);
      if (accounts.length === 0) {
        return [];
      }
      const boxes = await Promise.all(accounts.map(a => readMailbox(a, signal)));
      return boxes.filter(Boolean);
    },

    async action({cmd, refs, prefs, signal}) {
      if (!refs || refs.length === 0) {
        return true;
      }
      const {uid, host} = refs[0];
      // the refs of one mailbox share its uid: anything else is refused, never sent to refs[0]'s account
      if (refs.some(r => !r || r.uid !== uid || r.host !== host)) {
        throw new Error('Yandex: messages of more than one account');
      }
      const ids = refs.map(r => r.mid);
      const idsParam = ids.length === 1 ? ids[0] : ids;

      if (cmd === 'rd') {
        return doMessages(uid, host, {action: 'mark', ids: idsParam, mailboxUid: 'null'}, signal);
      }
      if (cmd === 'tr') {
        const folders = await ensureFolders(uid, host, signal);
        if (!folders.trash) {
          throw new Error('Yandex: no trash folder');
        }
        // "delete" with a destination moves to trash (recoverable). VERIFIED.
        return doMessages(uid, host, {action: 'delete', ids: idsParam, movefile: folders.trash, with_sent: '0', mailboxUid: 'null'}, signal);
      }
      if (cmd === 'sp') {
        const folders = await ensureFolders(uid, host, signal);
        if (!folders.spam) {
          throw new Error('Yandex: no spam folder');
        }
        return doMessages(uid, host, {action: 'tospam', ids: idsParam, movefile: folders.spam, mailboxUid: 'null'}, signal);
      }
      if (cmd === 'rc_^i') {
        // can.archive is false: the move-to-archive shape is unverified. If it is
        // ever enabled, honour doReadOnArchive by marking read as well.
        if (prefs && prefs.doReadOnArchive) {
          await doMessages(uid, host, {action: 'mark', ids: idsParam, mailboxUid: 'null'}, signal);
        }
        throw new Error('Yandex: archive is not supported');
      }
      throw new Error(`Yandex: unknown action ${cmd}`);
    },

    async body({ref, signal}) {
      const {uid, host, mid} = ref;
      const store = await loadStore();
      const cached = store[uid] && store[uid].src;
      const order = cached ? [cached, ...SOURCE_TEMPLATES.filter(t => t !== cached)] : SOURCE_TEMPLATES;

      let lastErr;
      for (const tmpl of order) {
        const url = fillTemplate(tmpl, host, uid, mid);
        let res;
        try {
          res = await fetch(url, {credentials: 'include', cache: 'no-store', signal});
        } catch (e) {
          lastErr = e;
          continue;
        }
        if (!res.ok) {
          lastErr = new Error(`Yandex source HTTP ${res.status}`);
          continue;
        }
        const buf = new Uint8Array(await res.arrayBuffer());
        let head = '';
        for (let i = 0; i < Math.min(buf.length, 4096); i += 1) {
          head += String.fromCharCode(buf[i]);
        }
        if (!looksRfc822(head)) {
          lastErr = new Error('Yandex source: not an RFC822 message');
          continue;
        }
        if (cached !== tmpl) {
          await patchAccount(uid, {src: tmpl});
        }
        // We can only fetch this one message; the panel shows it as a single-item
        // conversation (thread fetch is not implemented).
        return [parseEml(buf)];
      }
      throw new Error(`Yandex: could not download the message (${lastErr ? lastErr.message : 'no template matched'})`);
    }
  };

  (self.MailServices = self.MailServices || {})[service.id] = service;
}
