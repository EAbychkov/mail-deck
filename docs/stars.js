// Puts the repository's live star count into the header's GitHub button; the number in the
// page itself stays if GitHub does not answer.
(async () => {
  const link = document.querySelector('.top .gh');
  if (!link) {
    return;
  }
  try {
    const r = await fetch('https://api.github.com/repos/nord-express/mail-deck');
    if (!r.ok) {
      return;
    }
    const n = (await r.json()).stargazers_count;
    if (typeof n !== 'number') {
      return;
    }
    link.querySelector('.stars').textContent = n < 1000 ? String(n) : (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    link.setAttribute('aria-label', 'Source on GitHub, stars: ' + n);
  }
  catch (e) {}
})();
