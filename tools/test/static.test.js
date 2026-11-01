// What can be told without running anything: every script parses; the scripts
// that share one global scope (the background's, each page's) do not declare
// the same name twice; every locale has the panel's and the settings' strings.
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const EXT = path.join(__dirname, '../../extension');
const results = [];
const ok = (name, pass, detail = '') => results.push([name, pass, detail]);

const walk = dir => fs.readdirSync(dir, {withFileTypes: true}).flatMap(d =>
  d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
const parses = file => {
  const r = spawnSync(process.execPath, ['--check', file], {encoding: 'utf8'});
  return r.status === 0 ? '' : r.stderr.split('\n').slice(0, 5).join(' ');
};

// every script on its own
const scripts = walk(EXT).filter(f => f.endsWith('.js'));
const broken = scripts.map(f => [f, parses(f)]).filter(([, e]) => e);
ok(`${scripts.length} scripts parse`, broken.length === 0, broken.map(([f, e]) => path.relative(EXT, f) + ': ' + e).join('; '));

// the scripts of one scope, in the order they load
const together = (name, files) => {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mail-deck-')), 'scope.js');
  fs.writeFileSync(tmp, files.map(f => fs.readFileSync(f, 'utf8')).join('\n;\n'));
  const e = parses(tmp);
  ok(`${name}: ${files.length} scripts share one scope without a clash`, !e, e);
};
const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
together('background', manifest.background.scripts.map(s => path.join(EXT, s)));
for (const page of walk(EXT).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(page, 'utf8');
  const srcs = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map(m => m[1])
    .map(src => src.startsWith('/') ? path.join(EXT, src) : path.join(path.dirname(page), src))
    .filter(f => fs.existsSync(f));
  if (srcs.length > 1) {
    together(path.relative(EXT, page), srcs);
  }
}

// every mail service (core/services/*.js) is loaded wherever the others are, describes itself
// fully, and asks only for hosts the manifest lets it ask for
const SERVICES = fs.readdirSync(path.join(EXT, 'core/services')).filter(f => f.endsWith('.js')).sort();
const loads = (where, text) => {
  const missing = SERVICES.filter(f => !text.includes('/core/services/' + f));
  ok(`${where} loads the ${SERVICES.length} mail services`, missing.length === 0, missing.join(' '));
};
loads('manifest', JSON.stringify(manifest.background.scripts));
loads('worker.js', fs.readFileSync(path.join(EXT, 'worker.js'), 'utf8'));
loads('panel', fs.readFileSync(path.join(EXT, 'data/panel/index.html'), 'utf8'));
loads('settings', fs.readFileSync(path.join(EXT, 'data/settings/index.html'), 'utf8'));
{
  const vm = require('vm');
  const ctx = {};
  ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of SERVICES) {
    vm.runInContext(fs.readFileSync(path.join(EXT, 'core/services', f), 'utf8'), ctx, {filename: f});
  }
  const optional = manifest.optional_host_permissions || [];
  const found = Object.values(ctx.MailServices || {});
  ok(`${found.length} mail services register themselves`, found.length === SERVICES.length);
  for (const s of found) {
    const problems = [
      !/^[a-z]+$/.test(s.id) && 'id',
      !s.name && 'name',
      !(s.origins?.length) && 'origins',
      ...(s.origins || []).filter(o => !optional.includes(o)).map(o => 'not in optional_host_permissions: ' + o),
      !(s.hosts?.length) && 'hosts',
      ...(s.hosts || []).filter(h => !(s.origins || []).some(o => h.startsWith(o.replace(/\*$/, '')))).map(h => 'host outside its origins: ' + h),
      !/^https:\/\//.test(s.signIn || '') && 'signIn',
      typeof s.compose !== 'function' || !/^https:\/\//.test(s.compose()) ? 'compose' : '',
      !s.can && 'can',
      ...['collect', 'action'].filter(k => typeof s[k] !== 'function'),
      s.can?.body && typeof s.body !== 'function' && 'body',
      ...(s.rewrite || []).filter(r => !r.urlFilter || !/^https:\/\/[^/]+$/.test(r.origin || '')).map(() => 'rewrite')
    ].filter(Boolean);
    ok(`mail service ${s.id} is complete`, problems.length === 0, problems.join('; '));
  }
}

// every locale: parses, and has en's panel and settings strings with the same placeholders
const LOCALES = path.join(EXT, '_locales');
const read = lang => JSON.parse(fs.readFileSync(path.join(LOCALES, lang, 'messages.json'), 'utf8'));
const holes = text => (String(text).match(/\$\d/g) || []).sort().join(',');
const en = read('en');
const keys = Object.keys(en).filter(k => k.startsWith('panel_') || k.startsWith('opt_'));
for (const lang of fs.readdirSync(LOCALES)) {
  let d;
  try {
    d = read(lang);
  }
  catch (e) {
    ok(`locale ${lang} parses`, false, e.message);
    continue;
  }
  const missing = keys.filter(k => !d[k]);
  const wrong = keys.filter(k => d[k] && holes(d[k].message) !== holes(en[k].message));
  ok(`locale ${lang}: ${keys.length} strings, placeholders match`, missing.length + wrong.length === 0,
    [missing.length && 'missing ' + missing.slice(0, 6).join(' '), wrong.length && 'placeholders ' + wrong.slice(0, 6).join(' ')]
      .filter(Boolean).join('; '));
}

// The older strings the code still reads by name: chrome.i18n.getMessage('…') anywhere, the
// toolbar menu's label_<n> ids (context.js builds some of their names) and the manifest's
// __MSG_…__. A line that is commented out does not count.
const code = walk(EXT).filter(f => /\.(js|html)$/.test(f))
  .map(f => fs.readFileSync(f, 'utf8').replace(/^\s*\/\/.*$/gm, '')).join('\n');
const older = [...new Set([
  ...[...code.matchAll(/getMessage\(\s*['"]([A-Za-z0-9_]+)['"]\s*[,)]/g)].map(m => m[1]),
  ...[...code.matchAll(/['"](label_\d+)['"]/g)].map(m => m[1]),
  ...[...JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)].map(m => m[1])
])].filter(k => !/^(panel_|opt_)/.test(k)).sort();
{
  const absent = older.filter(k => !en[k]);
  ok(`en has the ${older.length} older strings the code reads`, absent.length === 0, absent.join(' '));
}
// the notification text: only the tokens check.js replaces, the same ones as English
const TOKENS = ['author_name', 'author_email', 'title', 'summary', 'break'];
const tokens = text => [...new Set((String(text).match(/\[[^\]]*\]/g) || []).map(s => s.slice(1, -1)))].sort().join(',');
// a value still in English: Latin letters only, once brand names, the label names a user types,
// [tokens], $1 and addresses are taken out; looked for only in a language written in another script
const BRANDS = /Mail Deck|Gmail™?|Google Meet|Google|Chrome|Yahoo|AOL|Proton|Yandex|Mail\.ru|\binbox\b|\bimportant\b|\[[^\]]*\]|\$\d|https?:\/\/\S+|\S+@\S+/g;
const letters = text => String(text).replace(BRANDS, '').match(/\p{L}/gu) || [];
const latinOnly = text => {
  const l = letters(text);
  return l.length > 0 && l.every(c => /\p{Script=Latin}/u.test(c));
};
for (const lang of fs.readdirSync(LOCALES)) {
  let d;
  try {
    d = read(lang);
  }
  catch (e) {
    continue;
  }
  const missing = older.filter(k => en[k] && !d[k]?.message);
  const wrong = older.filter(k => en[k] && d[k] && holes(d[k].message) !== holes(en[k].message));
  const format = d.notification && en.notification && (tokens(d.notification.message) !== tokens(en.notification.message) ||
    tokens(d.notification.message).split(',').some(t => t && !TOKENS.includes(t)));
  ok(`locale ${lang}: ${older.length} older strings, placeholders and notification [tokens] match`,
    missing.length + wrong.length === 0 && !format,
    [missing.length && 'missing ' + missing.join(' '), wrong.length && 'placeholders ' + wrong.join(' '),
      format && 'notification tokens ' + tokens(d.notification.message)].filter(Boolean).join('; '));
  // a language whose own strings are mostly in another script than Latin
  const own = keys.map(k => d[k]?.message).filter(Boolean).flatMap(letters);
  if (lang !== 'en' && own.filter(c => /\p{Script=Latin}/u.test(c)).length < own.length / 2) {
    const english = [...keys, ...older].filter(k => d[k] && latinOnly(d[k].message));
    ok(`locale ${lang}: no string the code reads is left in English`, english.length === 0,
      english.map(k => `${k}="${d[k].message}"`).slice(0, 8).join('; '));
  }
}

for (const [name, pass, detail] of results) {
  console.log(pass ? 'ok' : 'not ok', name + (pass || !detail ? '' : ' - ' + detail));
}
process.exit(results.every(([, pass]) => pass) ? 0 : 1);
