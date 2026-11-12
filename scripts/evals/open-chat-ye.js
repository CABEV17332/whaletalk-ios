(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // 打开和第二个人（夜猫子）的会话，方便看窄一点的聊天
  for (let i = 0; i < 40; i += 1) {
    if (document.querySelectorAll('.conv').length >= 3) break;
    await sleep(150);
  }
  const rows = [...document.querySelectorAll('.conv')];
  (rows.find((row) => row.textContent.includes('夜猫子')) || rows[0])?.click();
  await sleep(800);
})();
