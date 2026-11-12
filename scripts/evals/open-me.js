(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 30; i += 1) {
    if (document.querySelectorAll('.tab').length) break;
    await sleep(150);
  }
  [...document.querySelectorAll('.tab')].find((t) => t.textContent.trim() === '我')?.click();
  await sleep(700);
})();
