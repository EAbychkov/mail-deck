// chrome.* and Gmail for the panel under test: three mailboxes, Gmail's search,
// a three-message thread with an attachment, and a 700px newsletter (?wide=1).
// It records what the panel sends (__sent), stores (__set) and prints (__prints).
// A test may make Gmail fail: __printStatus answers the print view, __searchFails(m) the search.
(() => {
  const q = new URLSearchParams(location.search);
  const lang = q.get('lang') || 'ru';
  const load = l => { const x = new XMLHttpRequest(); x.open('GET', '/_locales/' + l + '/messages.json', false); x.send(); return JSON.parse(x.responseText); };
  const msgs = Object.assign(load('en'), load(lang));
  const now = Date.now();
  const iso = m => new Date(now - m * 60000).toISOString();
  const entry = (u, id, name, email, title, summary, m) => ({link: `https://mail.google.com/mail/u/${u}?account_id=x&message_id=${id}&view=conv&extsrc=atom`, id: 'tag:' + id, author_name: name, author_email: email, title, summary, modified: iso(m)});
  const acc = (u, email, entries, n) => ({meta: {}, newIDs: [], xml: {title: email, link: `https://mail.google.com/mail/u/${u}/#inbox`, rootLink: `https://mail.google.com/mail/u/${u}`, fullcount: n ?? entries.length, entries}});
  const caught = q.get('s') === 'caught';
  // ?s=services: a Gmail account next to Yahoo (reads in the panel) and Proton (opens on its site)
  const sentry = (service, base, id, name, email, title, m) => ({link: base + '/m/' + id, id: service + ':' + id, ref: {id}, author_name: name, author_email: email, title, summary: 'about ' + id, modified: iso(m)});
  const box = (service, base, email, entries) => ({meta: {service}, newIDs: [], xml: {title: email, label: '', service, link: base, rootLink: base, fullcount: entries.length, entries}});
  const services = q.get('s') === 'services' && [
    acc(0, 'evgeny@example.com', [entry(0, 'a1', 'Anna Petrova', 'anna@figma.com', 'Макеты на ревью', 'Посмотри', 4)]),
    box('yahoo', 'https://mail.yahoo.com/n/folders/1', 'ev@yahoo.com', [
      sentry('yahoo', 'https://mail.yahoo.com/n/folders/1', 'y1', 'Bo', 'bo@x.test', 'Yahoo one', 10),
      sentry('yahoo', 'https://mail.yahoo.com/n/folders/1', 'y2', 'Cy', 'cy@x.test', 'Yahoo two', 20)
    ]),
    box('proton', 'https://mail.proton.me/u/0/inbox', 'ev@proton.me', [sentry('proton', 'https://mail.proton.me/u/0/inbox', 'p1', 'Di', 'di@x.test', 'Proton one', 30)])
  ];
  // ?s=codes: mail with one-time codes, and mail with numbers that are none
  const codes = q.get('s') === 'codes' && [acc(0, 'evgeny@example.com', [
    entry(0, 'c1', 'Google', 'no-reply@accounts.google.com', 'Your Google verification code', 'G-482913 is your Google verification code.', 1),
    entry(0, 'c2', 'Банк', 'alerts@bank.test', 'Код подтверждения', 'Ваш код: 7310. Никому его не сообщайте.', 2),
    entry(0, 'c3', 'Stripe', 'billing@stripe.com', 'Invoice #1042 for 2026', 'Questions? Call +1 415 555 0134. Our code of conduct changed.', 3),
    entry(0, 'c4', 'GitHub', 'noreply@github.com', '[GitHub] Please verify your device', 'Verification code: 123-456', 4),
    entry(0, 'c5', 'Anna', 'anna@figma.com', 'Встреча', 'В 10:30, комната 4815', 5)
  ])];
  const nine = ['bychkovea@gmail.com', 'evgeny@arbitron.app', 'abrahamlincolncrypto@gmail.com', 'georgewashingtoncypto@gmail.com', 'knivesmagician@gmail.com', 'thomasjeffersoncrypto@gmail.com', 'codewithevgeny@gmail.com', 'cryptobychkov@gmail.com', 'eco.toplivo.msk@gmail.com'];
  const objs = services || codes || (q.get('s') === 'nine' ? nine.map((m, i) => acc(i, m, [])) : caught ? [acc(0, 'evgeny@example.com', []), acc(1, 'work@arbitron.example', [])] : [
    acc(0, 'evgeny@example.com', [
      entry(0, 'a1', 'Anna Petrova', 'anna@figma.com', 'Макеты на ревью', 'Посмотри, пожалуйста, до пятницы', 4),
      entry(0, 'a2', 'GitHub', 'noreply@github.com', 'New sign-in', 'A new sign-in to your account', 95)
    ], 5),
    acc(1, 'work@arbitron.example', [entry(1, 'b1', 'Ivan', 'ivan@gmail.com', 'Созвон', 'Давай созвонимся сегодня?', 30)]),
    acc(2, 'old@example.org', [])
  ]);
  const local = {accounts: services ? {'evgeny@example.com': {}, 'ev@yahoo.com': {service: 'yahoo'}, 'ev@proton.me': {service: 'proton'}, 'gone@yahoo.com': {service: 'yahoo'}} :
    q.get('s') === 'nine' ? Object.fromEntries(nine.map(m => [m, {}])) : {'evgeny@example.com': {}, 'work@arbitron.example': {}, 'old@example.org': {}, 'gone@example.com': {}},
    accountOrder: [], panelScale: Number(q.get('scale') || 1), readOnOpen: q.get('read') === '1', 'remind.links': [],
    autoAdvance: q.get('advance') === '1', 'badge.count': q.get('badge') || 'all'};
  window.__sent = []; window.__set = [];
  // what the panel copies (__copied): a page under test has no clipboard of its own to ask
  Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async s => { window.__copied = s; }}});
  // a link opened from the panel closes it; the page under test has to stay
  window.close = () => {};
  const row = (thread, subject, from, text, mins, labels) => ({subject, thread, labels, date: now - mins * 60000, from, text});
  const search = ({url, query}) => {
    const n = Number(url.match(/u\/(\d+)/)[1]);
    if (query.includes('is:unread')) {
      return n === 0 ? [
        row('a1', 'Макеты на ревью', ['Anna Petrova', 'anna@figma.com'], '…', 4, ['^u', '^i', 'STARRED']),
        row('a2', 'New sign-in', ['GitHub', 'noreply@github.com'], '…', 95, ['^u', '^i']),
        row('a3', 'Счёт за октябрь', ['Бухгалтерия', 'billing@stripe.com'], 'Счёт №1042 во вложении', 600, ['^u', '^i']),
        row('a4', 'Weekly digest', 'Notion <team@notion.so>', 'Your workspace this week', 2000, ['^u', '^i', 'STARRED']),
        row('a5', 'Приглашение', ['Мария', 'maria@yandex.ru'], 'Приходи в субботу', 3000, ['^u', '^i'])
      ] : [];
    }
    return n === 1 ? [] : [
      row('s' + n + '1', 'Invoice #1042', ['Stripe', 'billing@stripe.com'], 'Your invoice is ready', 300, ['^u']),
      row('s' + n + '2', 'Invoice #1031', ['Stripe', 'billing@stripe.com'], 'Paid, thank you', 50000, [])
    ];
  };
  const respond = (m, cb) => {
    window.__sent.push(m);
    let r;
    if (m.method === 'gmail.search') r = window.__searchFails?.(m) ? null : search(m);
    if (m.method === 'get-at') r = 'AT';
    // what a service answers: markup that must not run in the reader
    // and markup that must not load before Show pictures, nor open a link over the panel
    const px = k => `${location.origin}/__pixel?k=services-svc-${k}`;
    if (m.method === 'services.body') r = {messages: [
      {name: 'Bo', email: 'bo@x.test', date: '2026-10-30T09:00:00Z', to: 'ev@yahoo.com', html: '<p>first</p>'},
      {name: 'Cy', email: 'cy@x.test', date: '2026-10-31T09:00:00Z', to: 'ev@yahoo.com',
        html: '<html><head><style>p{color:red}</style></head><body><p id="safe">second <a href="javascript:alert(1)">x</a><a href="/rel">rel</a></p><script>window.parent.__ran=1</script><img src="x.png" onerror="window.parent.__ran=1"><iframe src="https://evil.test"></iframe><form action="https://evil.test"><input></form>' +
          `<div style="width:9px;height:9px;background:URL(${px('css')})"></div><svg width="9" height="9"><image href="${px('svg')}" width="9" height="9"/></svg>` +
          `<video src="${px('video')}" poster="${px('poster')}" width="9" height="9"></video>` +
          `<a id="top" href="https://evil.test/top" target="_top" ping="${px('ping')}">top</a> <a id="hash" href="#safe">hash</a> <a id="data" href="data:text/plain,x">data</a>` +
          '<div id="editable" contenteditable>edit</div></body></html>'}
    ]};
    cb && setTimeout(() => cb(r), 10);
    return new Promise(res => setTimeout(() => res(r), 10));
  };
  const store = (area, d) => (defaults, cb) => {
    const out = {};
    const keys = typeof defaults === 'string' ? [defaults] : Object.keys(defaults || {});
    for (const k of keys) out[k] = k in area ? area[k] : defaults[k];
    cb && cb(out);
    return Promise.resolve(out);
  };
  window.chrome = {
    i18n: {getUILanguage: () => lang, getMessage: (k, subs = []) => { const m = msgs[k]; return m ? m.message.replace(/\$(\d)/g, (_, i) => subs[i - 1] ?? '') : ''; }},
    runtime: {sendMessage: respond, onMessage: {addListener() {}}, openOptionsPage() {}},
    storage: {
      session: (() => { const area = {'cached-objects': objs, 'resolved.links': []}; return {get: store(area), set: o => { Object.assign(area, o); return Promise.resolve(); }, remove: k => { [k].flat().forEach(x => delete area[x]); return Promise.resolve(); }, area}; })(),
      local: {get: store(local), set: (o) => { window.__set.push(o); Object.assign(local, o); return Promise.resolve(); }},
      onChanged: {addListener() {}}
    },
    sidePanel: {open: () => Promise.resolve()},
    windows: {getCurrent: () => Promise.resolve({id: 1})}
  };
  // the print view of a three-message thread with a recipient line and one attachment
  const msg = (name, email, date, to, body, att) => `<table width=100% cellpadding=0 cellspacing=0 border=0 class="message">
<tr><td><font size=-1><b>${name} </b>&lt;${email}&gt;</font></td><td align=right><font size=-1>${date}</font></td></tr>
<tr><td colspan=2><font size=-1 class=recipient><div>To: Evgeny &lt;evgeny@example.com&gt;</div>${to}</font></td></tr>
<tr><td colspan=2><table width=100% cellpadding=12 cellspacing=0 border=0><tr><td><div style="overflow: hidden;"><font size=-1>${body}</font></div>${att || ''}</td></tr></table></td></tr></table>`;
  const att = `<hr><table class=att cellspacing=0 cellpadding=5 border=0><tr><td><table cellspacing=0 cellpadding=0><tr><td><a href="?ui=2&ik=abc&view=att&th=a1&attid=0.1&disp=attd&zw" target=_blank><img width=16 height=16 src="https://ssl.gstatic.com/attach.png"></a></td><td width=7></td><td><b>Макеты-v3.pdf</b><br>1.2 MB&nbsp;&nbsp;<a href="?ui=2&ik=abc&view=att&th=a1&attid=0.1&disp=safe&zw" target=_blank>View</a>&nbsp;<a href="?ui=2&ik=abc&view=att&th=a1&attid=0.1&disp=attd&zw" target=_blank>Download</a></td></tr></table></td></tr></table>`;
  const page = `<html><body>` + [
    msg('Evgeny', 'evgeny@example.com', 'Mon, Oct 26 at 10:02', '', 'Аня, пришли, пожалуйста, макеты к пятнице.'),
    msg('Anna Petrova', 'anna@figma.com', 'Tue, Oct 27 at 18:40', '<div>Cc: design@figma.com</div>', 'Почти готово, завтра пришлю. <a href="https://www.google.com/url?q=https://figma.com/file/x&sa=D">Черновик</a>'),
    msg('Anna Petrova', 'anna@figma.com', 'Fri, Oct 30 at 19:51', '', 'Привет! Макеты во вложении, посмотри, пожалуйста, до пятницы.<br><br>— Аня' +
      `<img width=1 height=1 src="${location.origin}/__pixel?k=${q.get('scenario')}-gmail">`, att)
  ].join('<hr>') + `</body></html>`;
  // a newsletter 700px wide, with its picture loading a moment later
  const wide = `<html><body><table width=100% cellpadding=0 cellspacing=0 border=0 class="message">
<tr><td><font size=-1><b>Московский транспорт </b>&lt;deptrans@transport.mos.ru&gt;</font></td><td align=right><font size=-1>Fri, Oct 30 at 20:32</font></td></tr>
<tr><td colspan=2><font size=-1 class=recipient><div>To: bychkovea@gmail.com</div></font></td></tr>
<tr><td colspan=2><table width=100% cellpadding=12 cellspacing=0 border=0><tr><td><div style="overflow: hidden;"><font size=-1>
<table width="700" style="width:700px;background:#000" cellpadding=30><tr><td><img width="640" src="data:image/svg+xml,${encodeURIComponent('<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'640\' height=\'420\'><rect width=\'640\' height=\'420\' fill=\'%23e98a2c\'/><circle cx=\'320\' cy=\'210\' r=\'150\' fill=\'%23234\'/></svg>')}"><p style="color:#fff;font:20px Arial">Пройдите опрос о самокатах</p></td></tr></table>
</font></div></td></tr></table></td></tr></table></body></html>`;
  const realFetch = window.fetch;
  window.__prints = 0;
  window.fetch = (url, o) => String(url).includes('view=pt') && ++window.__prints ? Promise.resolve(new Response(q.get('wide') ? wide : page, {status: window.__printStatus || 200})) : realFetch(url, o);
})();
