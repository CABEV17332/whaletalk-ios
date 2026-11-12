(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 40; i += 1) {
    if (document.querySelectorAll('.conv').length >= 3) break;
    await sleep(150);
  }
  const rows = [...document.querySelectorAll('.conv')];
  const target = rows.find((row) => row.textContent.includes('阿波')) || rows[0];
  target?.click();
  await sleep(1200);
})();
