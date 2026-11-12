(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 30; i += 1) {
    if (document.querySelector('.nav__trailing .icon-btn')) break;
    await sleep(150);
  }
  document.querySelector('.nav__trailing .icon-btn').click();
  await sleep(700);
  const input = document.querySelector('.sheet__body input');
  input.value = 'ab';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(900);
})();
