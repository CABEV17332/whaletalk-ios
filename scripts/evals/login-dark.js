(async () => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'xiaojingyu', password: 'whale1234' }),
  });
  const data = await res.json();
  localStorage.setItem('whaletalk.token', data.token);
  localStorage.setItem('whaletalk.theme', 'dark');
  location.hash = '#/chats';
  location.reload();
})();
