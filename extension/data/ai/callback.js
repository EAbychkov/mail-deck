'use strict';
// The page a ChatGPT sign-in comes back to. While one is underway, ai.js keeps a rule that turns
// the visit to its loopback address into one of this page, with the query kept: the module
// finishes the sign-in, and the page says how it went; when it went well, it goes on its own.

{
  // the time the page shows that the sign-in went well
  const DONE = 2000;
  const $ = id => document.getElementById(id);
  const say = (key, ...subs) => chrome.i18n.getMessage(key, subs.map(String));
  document.documentElement.lang = chrome.i18n.getUILanguage();
  // Arabic and Hebrew read from the right
  document.documentElement.dir = chrome.i18n.getMessage('@@bidi_dir') || 'ltr';
  document.title = say('ai_signin_title') || document.title;
  $('retry').textContent = say('ai_signin_retry') || $('retry').textContent;

  const show = (state, title, text = '') => {
    $('card').dataset.state = state;
    $('title').textContent = title;
    $('text').textContent = text;
    $('text').hidden = !text;
    $('retry').hidden = state !== 'bad';
  };
  const failed = e => {
    show('bad', say('ai_signin_failed') || 'Not signed in', e?.name === 'AIError' && e.message ? e.message :
      say('ai_err_sign_in') || 'Signing in with ChatGPT did not finish. Try again.');
    $('retry').focus();
  };
  // this tab: it goes, and the one the sign-in was started from comes to the front
  const here = Promise.resolve(chrome.tabs?.getCurrent?.()).catch(() => null);
  const leave = async back => {
    const tab = await here;
    if (back && back !== tab?.id) {
      await chrome.tabs.update(back, {active: true}).catch(() => {});
    }
    if (tab?.id) {
      chrome.tabs.remove(tab.id).catch(() => window.close());
    }
    else {
      window.close();
    }
  };

  // the code in the address is spent with this visit: the address no longer shows it
  const query = location.search;
  history.replaceState(null, '', location.pathname);
  show('wait', say('ai_signin_working') || 'Signing in…');
  if (!self.AI?.chatgpt) {
    failed(null);
  }
  else {
    self.AI.chatgpt.complete(query).then(r => {
      const title = r.email ? say('ai_signin_done', r.email) || 'Signed in as ' + r.email : say('ai_signin_done_plain') || 'Signed in to ChatGPT';
      // signed in, but without the plan's use allowed: the page stays to say so
      if (!r.plan) {
        return show('ok', title, say('ai_err_no_plan') || 'ChatGPT plan usage is not available for this account.');
      }
      show('ok', title, say('ai_signin_close') || 'You can close this tab.');
      setTimeout(() => leave(r.tab), DONE);
    }, failed);
  }
  // a new sign-in from the click, in this tab
  $('retry').onclick = () => {
    show('wait', say('ai_signin_working') || 'Signing in…');
    self.AI.chatgpt.signIn({open: url => location.assign(url)}).catch(failed);
  };
}
