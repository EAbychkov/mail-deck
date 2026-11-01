/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/*
 * Proton Mail through the browser's own session. Adapted from Mail Notifier Hub by MS-Jahan,
 * src/providers/proton/api.js at commit 232ca2d (2026-10-22),
 * https://github.com/MS-Jahan/mail-notifier-hub (MPL-2.0). Request shapes also follow
 * go-proton-api (MIT), https://github.com/ProtonMail/go-proton-api.
 *
 * Only metadata is read (sender, subject, time). Bodies are end-to-end encrypted; this file never
 * fetches, decrypts or touches key material.
 */

{
  const ORIGIN = 'https://mail.proton.me';
  const API = ORIGIN + '/api/';
  const KEY = 'service.proton';
  // system label ids of the web app
  const LABEL = {inbox: '0', trash: '3', spam: '4', archive: '6'};
  const OK = 1000;
  const APP_VERSION_BAD = 5003;
  const HUMAN = [9001, 12087]; // human verification required, its token invalid
  // statuses on which auth/refresh rules the session invalid, as in the web client
  const DEAD = [400, 401, 422];
  const SINGLE = 1; // MailSettings.ViewMode: 0 groups conversations, 1 shows single messages
  const FRESH = 60 * 60 * 1000; // how long a session's identity, slot and view mode are reused
  const STALE = 30 * 60 * 1000; // a session that fails a check shows its last mailbox this long, as the runner does
  const PAGE = 20;

  const signedOut = () => Object.assign(new Error('Proton: signed out'), {signedOut: true});

  const load = async () => {
    const state = (await chrome.storage.session.get(KEY))[KEY] || {};
    state.users = state.users || {};
    state.mailboxes = state.mailboxes || {};
    return state;
  };
  const save = state => chrome.storage.session.set({[KEY]: state});

  // one HttpOnly AUTH-<uid> cookie (path /api/) per session signed in to the web app
  const uids = async () => {
    const cookies = await chrome.cookies.getAll({url: API});
    const names = cookies.map(c => c.name).filter(n => n.startsWith('AUTH-') && n.length > 5);
    return [...new Set(names.map(n => n.slice(5)))];
  };

  // The web app sends its own build in x-pm-appversion and Proton refuses unknown or old ones.
  // Sessions asked at once wait for one answer.
  let asking = null;
  const version = async (state, signal, renew = false) => {
    if (state.version && !renew) {
      return state.version;
    }
    if (!asking) {
      asking = (async () => {
        const r = await fetch(ORIGIN + '/assets/version.json', {credentials: 'omit', cache: 'no-store', signal});
        if (!r.ok) {
          throw new Error('Proton: no app version (HTTP ' + r.status + ')');
        }
        const j = await r.json().catch(() => ({}));
        // {"branch": "proton-mail@5.0.138.11", "version": "5.0.138.11", ...}
        const v = /^\d+(\.\d+)+$/.test(j.version || '') ? j.version : (/@(\d+(?:\.\d+)+)$/.exec(j.branch || '') || [])[1];
        if (!v) {
          throw new Error('Proton: unreadable app version');
        }
        return v;
      })().finally(() => asking = null);
    }
    state.version = await asking;
    return state.version;
  };

  const headers = async (state, uid, signal) => ({
    'x-pm-uid': uid,
    'x-pm-appversion': 'web-mail@' + await version(state, signal),
    'Accept': 'application/vnd.protonmail.v1+json'
  });

  // The web app refreshes under a lock shared by its tabs, which we cannot take. A tab showing this
  // session refreshes it within a minute, so leave it to the tab rather than race it.
  const tabOpen = async (state, uid) => {
    try {
      const slot = state.users[uid] ? state.users[uid].slot : undefined;
      const tabs = await chrome.tabs.query({url: ORIGIN + '/*'});
      return tabs.some(t => {
        const m = /^https:\/\/mail\.proton\.me\/u\/(\d+)(\/|$)/.exec(t.url || '');
        return slot === undefined || (m && Number(m[1]) === slot);
      });
    }
    catch (e) {
      return false;
    }
  };

  // POST auth/refresh with only x-pm-uid: the REFRESH-<uid> cookie (path /api/auth/refresh) carries the
  // token and the answer sets new AUTH/REFRESH cookies.
  const renew = async (state, uid, signal) => {
    if (await tabOpen(state, uid)) {
      throw new Error('Proton: an open tab is renewing the session');
    }
    const r = await fetch(API + 'auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: await headers(state, uid, signal),
      signal
    });
    if (DEAD.includes(r.status)) {
      throw signedOut();
    }
    if (r.status === 429) {
      throw new Error('rate limited');
    }
    if (!r.ok) {
      throw new Error('Proton: refresh HTTP ' + r.status);
    }
  };
  // a check, the settings' diagnostics and an action may meet the same expired token at once
  const refreshing = new Map();
  const refresh = (state, uid, signal) => {
    if (!refreshing.has(uid)) {
      refreshing.set(uid, renew(state, uid, signal).finally(() => refreshing.delete(uid)));
    }
    return refreshing.get(uid);
  };

  // Repeats a request only when Proton refused it before running it (expired token, old app version).
  const call = async (state, uid, method, path, {body, signal, refreshed = false, renewed = false} = {}) => {
    const h = await headers(state, uid, signal);
    if (body) {
      h['Content-Type'] = 'application/json';
    }
    const r = await fetch(API + path, {
      method,
      credentials: 'include',
      headers: h,
      body: body ? JSON.stringify(body) : undefined,
      signal
    });
    if (r.status === 429) {
      throw new Error('rate limited');
    }
    const j = await r.json().catch(() => null);
    const code = j && j.Code;
    if (code === APP_VERSION_BAD && !renewed) {
      await version(state, signal, true);
      return call(state, uid, method, path, {body, signal, refreshed, renewed: true});
    }
    if (HUMAN.includes(code)) {
      throw new Error('Proton: human verification required');
    }
    if (r.status === 401) {
      if (refreshed) {
        throw signedOut();
      }
      await refresh(state, uid, signal);
      return call(state, uid, method, path, {body, signal, refreshed: true, renewed});
    }
    if (!r.ok) {
      throw new Error('Proton: HTTP ' + r.status + (code ? ' (' + code + ')' : ''));
    }
    if (!j) {
      throw new Error('Proton: unreadable answer');
    }
    return j;
  };

  // Runs run(uid) for every session at once. A session signed out is forgotten; any other failure
  // goes to failed and leaves the other sessions their answer. Resolves the uids that answered.
  const each = async (state, list, failed, run) => (await Promise.all(list.map(async uid => {
    try {
      await run(uid);
      return uid;
    }
    catch (e) {
      if (e.signedOut) {
        delete state.users[uid];
      }
      else {
        failed.push({uid, e});
      }
    }
  }))).filter(Boolean);

  /*
   * Who each session is, the /u/<LocalID>/ slot the web app shows it under, and its view mode
   * (links differ). The uid of the AUTH cookie is not the UID that sessions/local lists, so sessions
   * are matched by user id. Kept for FRESH; a sign-in again gets a new uid anyway. A session it
   * could not ask keeps what it had, if anything.
   */
  const identify = async (state, list, signal, failed) => {
    let stale = list.filter(uid => !(state.users[uid] && Date.now() - state.users[uid].at < FRESH));
    // the list of sessions, asked through the first one that answers
    let slots;
    while (!slots && stale.length) {
      const [uid] = stale;
      const ok = await each(state, [uid], failed, async () => {
        slots = (await call(state, uid, 'GET', 'auth/v4/sessions/local', {signal})).Sessions;
        if (!Array.isArray(slots)) {
          slots = undefined;
          throw new Error('Proton: unreadable sessions');
        }
      });
      if (ok.length === 0) {
        stale = stale.slice(1);
      }
    }
    await each(state, stale, failed, async uid => {
      const [{User: u}, {MailSettings: settings}] = await Promise.all([
        call(state, uid, 'GET', 'core/v4/users', {signal}),
        call(state, uid, 'GET', 'mail/v4/settings', {signal})
      ]);
      if (!u || !u.ID) {
        throw new Error('Proton: unreadable user');
      }
      const slot = slots.find(s => s.UserID === u.ID) || slots.find(s => u.Name && s.Username === u.Name);
      const old = state.users[uid];
      state.users[uid] = {
        id: u.ID,
        email: (u.Email || (slot && slot.PrimaryEmail) || u.Name || '').toLowerCase(),
        // without a listed slot, the last known one, else the first
        slot: slot && Number.isInteger(slot.LocalID) ? slot.LocalID : (old ? old.slot : 0),
        view: settings && settings.ViewMode === SINGLE ? SINGLE : 0,
        at: Date.now()
      };
    });
  };

  const unread = async (state, uid, signal) => {
    const {Counts: counts} = await call(state, uid, 'GET', 'mail/v4/messages/count', {signal});
    const inbox = Array.isArray(counts) ? counts.find(c => c.LabelID === LABEL.inbox) : undefined;
    if (!inbox || typeof inbox.Unread !== 'number') {
      throw new Error('Proton: unreadable count');
    }
    return inbox.Unread;
  };

  const messages = async (state, uid, signal) => {
    const q = new URLSearchParams({LabelID: LABEL.inbox, Unread: 1, Page: 0, PageSize: PAGE, Sort: 'Time', Desc: 1});
    let j = await call(state, uid, 'GET', 'mail/v4/messages?' + q, {signal});
    // Stale: the server's index was still updating; asking once more is what go-proton-api does
    if (j.Stale) {
      j = await call(state, uid, 'GET', 'mail/v4/messages?' + q, {signal});
    }
    if (!Array.isArray(j.Messages)) {
      throw new Error('Proton: unreadable list');
    }
    return j.Messages.filter(m => m && m.ID);
  };

  // IDs are base64url with padding; anything else is escaped for the path
  const part = id => /^[\w=-]+$/.test(id) ? id : encodeURIComponent(id);

  const entry = (m, user) => {
    const sender = m.Sender || {};
    // the web app routes /<label>/<element>/<message>: element is the conversation unless the
    // account shows single messages; the message part expands that message in the conversation
    // (read from the web app's router, not tried live)
    const path = user.view === SINGLE || !m.ConversationID ? part(m.ID) : part(m.ConversationID) + '/' + part(m.ID);
    return {
      id: 'proton:' + m.ID,
      link: ORIGIN + '/u/' + user.slot + '/inbox/' + path,
      ref: {id: m.ID, cid: m.ConversationID || ''},
      title: m.Subject || '',
      summary: '',
      modified: new Date((Number(m.Time) || 0) * 1000).toISOString(),
      author_name: sender.Name || sender.Address || '',
      author_email: (sender.Address || '').toLowerCase()
    };
  };

  const service = {
    id: 'proton',
    name: 'Proton Mail',
    origins: ['https://mail.proton.me/*'],
    hosts: ['https://mail.proton.me/'],
    signIn: 'https://account.proton.me/mail',
    // The web app opens its composer for #mailto=<mailto URL> on a mailbox page; without /u/<n> it
    // resumes the last used session and keeps the hash (read from its source, not tried live).
    compose: (to = '', subject = '') => {
      const address = String(to).replace(/[?&#\s]/g, '');
      const mailto = 'mailto:' + address + (subject ? '?subject=' + encodeURIComponent(subject) : '');
      return ORIGIN + '/inbox#mailto=' + encodeURIComponent(mailto);
    },
    can: {archive: true, spam: true, body: false},
    // Proton answers the extension's own Origin like any other client
    rewrite: [],

    async collect({signal} = {}) {
      const list = await uids();
      if (list.length === 0) {
        return [];
      }
      const state = await load();
      try {
        // every session at once: one that fails (say, its refresh left to an open tab) does not
        // take the others' mailboxes with it
        const failed = [];
        const counts = new Map();
        const counted = await each(state, list, failed, async uid => counts.set(uid, await unread(state, uid, signal)));
        await identify(state, counted, signal, failed);

        // signed out meanwhile, or two cookies of one account (an older session left behind)
        const seen = new Set();
        const live = counted.filter(uid => {
          const user = state.users[uid];
          if (!user || seen.has(user.id)) {
            return false;
          }
          seen.add(user.id);
          return true;
        });
        const found = new Map();
        const listed = await each(state, live, failed,
          async uid => found.set(uid, counts.get(uid) > 0 ? await messages(state, uid, signal) : []));

        const last = state.last || {};
        state.last = {};
        state.mailboxes = {};
        const boxes = [];
        const add = (uid, user, box) => {
          state.mailboxes[user.email] = uid;
          boxes.push({slot: user.slot, box});
        };
        for (const uid of listed) {
          const user = state.users[uid];
          const entries = found.get(uid)
            .sort((a, b) => (Number(b.Time) || 0) - (Number(a.Time) || 0))
            .slice(0, PAGE)
            .map(m => entry(m, user));
          const box = {email: user.email, inbox: ORIGIN + '/u/' + user.slot + '/inbox', unread: counts.get(uid), entries};
          state.last[user.id] = {at: Date.now(), box};
          add(uid, user, box);
        }
        // a known session that failed shows its last mailbox for a while
        for (const {uid} of failed) {
          const user = state.users[uid];
          const old = user && last[user.id];
          if (old && !state.last[user.id] && Date.now() - old.at < STALE) {
            state.last[user.id] = old;
            add(uid, user, old.box);
          }
        }
        if (boxes.length === 0 && failed.length) {
          throw failed[0].e;
        }
        return boxes.sort((a, b) => a.slot - b.slot).map(o => o.box);
      }
      finally {
        await save(state);
      }
    },

    async action({cmd, email, refs = [], prefs = {}, signal} = {}) {
      const ids = refs.map(r => r && r.id).filter(Boolean);
      if (ids.length === 0) {
        throw new Error('Proton: no message');
      }
      const state = await load();
      try {
        const signedIn = await uids();
        let uid = state.mailboxes[email];
        if (!signedIn.includes(uid)) {
          const failed = [];
          await identify(state, signedIn, signal, failed);
          uid = signedIn.find(u => state.users[u] && state.users[u].email === email);
          // not found, and a session could not be asked: that is the error to show
          if (!uid && failed.length) {
            throw failed[0].e;
          }
        }
        if (!uid) {
          throw new Error('Proton: mailbox not signed in');
        }
        const put = async (path, body) => {
          const j = await call(state, uid, 'PUT', path, {body, signal});
          const all = j.Responses;
          if (!Array.isArray(all) || all.length === 0 || all.some(o => !o || !o.Response || o.Response.Code !== OK)) {
            throw new Error('Proton rejected the action');
          }
        };
        const read = () => put('mail/v4/messages/read', {IDs: ids});
        const move = labelID => put('mail/v4/messages/label', {LabelID: labelID, IDs: ids});
        if (cmd === 'rd') {
          await read();
        }
        else if (cmd === 'rc_^i') {
          await move(LABEL.archive);
          if (prefs.doReadOnArchive) {
            await read();
          }
        }
        else if (cmd === 'tr') {
          await move(LABEL.trash);
        }
        else if (cmd === 'sp') {
          await move(LABEL.spam);
        }
        else {
          throw new Error('Proton: unknown action ' + cmd);
        }
        return true;
      }
      finally {
        await save(state);
      }
    }
  };
  (self.MailServices = self.MailServices || {})[service.id] = service;
}
