/* 首屏前先定主题，避免闪白 */
try {
  var stored = localStorage.getItem('whaletalk.theme') || 'auto';
  var dark =
    stored === 'dark' ||
    (stored === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
} catch (e) {
  /* ignore */
}
