(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 40; i += 1) {
    if (document.querySelectorAll('.conv').length >= 3) break;
    await sleep(150);
  }
  [...document.querySelectorAll('.conv')].find((row) => row.textContent.includes('夜猫子'))?.click();
  await sleep(1000);

  const field = document.querySelector('.composer textarea');
  field.value = '这条是从输入框里打出来发的，看看能不能实时出现 🫧';
  field.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(150);
  document.querySelector('.send-btn').click();
  await sleep(1500);
  return JSON.stringify({
    bubbles: document.querySelectorAll('.bubble').length,
    lastText: [...document.querySelectorAll('.bubble')].at(-1)?.textContent?.slice(0, 40),
  });
})();
