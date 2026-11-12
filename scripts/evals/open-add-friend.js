(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 30; i += 1) {
    if (document.querySelector('.nav__trailing .icon-btn')) break;
    await sleep(150);
  }
  document.querySelector('.nav__trailing .icon-btn')?.click();
  await sleep(900);
})();
