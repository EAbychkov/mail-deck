// A link of the mail opens in a tab of its own, never in this frame or over the panel, and
// only to a web page or a mail address: a click in front, next to the current tab;
// Ctrl/Cmd+click or the middle button behind it, so several open in a row; Shift+click in
// a new window. A jump inside the mail scrolls to its place.
{
  const OPEN = /^(https?|mailto):/i;
  const open = (e, background) => {
    const a = e.target.closest?.('a[href], area[href]');
    if (!a) {
      return true;
    }
    e.preventDefault();
    e.stopPropagation();

    const raw = a.getAttribute('href').trim();
    if (raw.startsWith('#')) {
      let id = raw.slice(1);
      try {
        id = decodeURIComponent(id);
      }
      catch (err) {}
      (id && (document.getElementById(id) || document.getElementsByName(id)[0]))?.scrollIntoView();
      return false;
    }
    let url;
    try {
      url = new URL(raw, document.baseURI).href;
    }
    catch (err) {
      return false;
    }
    if (!OPEN.test(url)) {
      return false;
    }
    if (e.shiftKey && !background) {
      chrome.windows.create({url});
      return false;
    }
    chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    }, tabs => {
      chrome.tabs.create({
        url,
        active: !background, // behind: allow the user to open multiple links
        index: tabs && tabs.length ? tabs[0].index + 1 : undefined
      });
    });
    return false;
  };

  addEventListener('click', e => e.button === 0 ? open(e, e.ctrlKey || e.metaKey) : true, true);
  addEventListener('auxclick', e => e.button === 1 ? open(e, true) : true, true);
}

// styling
chrome.storage.local.get({
  'styling_body': ''
}, prefs => {
  document.getElementById('styling_body').textContent = prefs['styling_body'];
});
