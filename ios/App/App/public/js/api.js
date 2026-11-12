const TOKEN_KEY = 'whaletalk.token';
const THEME_KEY = 'whaletalk.theme';

let token = localStorage.getItem(TOKEN_KEY) || '';

export class ApiError extends Error {
  constructor(status, message, code = 'error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getToken() {
  return token;
}

export function setToken(value) {
  token = value || '';
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'auto';
}

export function setTheme(value) {
  localStorage.setItem(THEME_KEY, value);
}

async function request(path, { method = 'GET', body, raw, headers = {}, signal } = {}) {
  const opts = { method, headers: { ...headers }, signal };
  if (token) opts.headers.authorization = `Bearer ${token}`;
  if (raw !== undefined) {
    opts.body = raw;
    if (!opts.headers['content-type']) {
      opts.headers['content-type'] = opts.body?.type || 'application/octet-stream';
    }
  } else if (body !== undefined) {
    opts.body = JSON.stringify(body);
    opts.headers['content-type'] = 'application/json';
  }

  let res;
  try {
    res = await fetch(path, opts);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, '网络连接不上服务器，检查一下网络吧', 'network');
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      window.dispatchEvent(new CustomEvent('whaletalk:unauthorized'));
    }
    throw new ApiError(res.status, data?.message || `请求失败（${res.status}）`, data?.error);
  }
  return data;
}

export const api = {
  config: () => request('/api/config'),

  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  me: () => request('/api/me'),
  updateMe: (payload) => request('/api/me', { method: 'PATCH', body: payload }),

  searchUsers: (q) => request(`/api/users/search?q=${encodeURIComponent(q)}`),
  friends: () => request('/api/friends'),
  sendFriendRequest: (username, message = '') =>
    request('/api/friends/requests', { method: 'POST', body: { username, message } }),
  acceptFriend: (id) => request(`/api/friends/requests/${id}/accept`, { method: 'POST' }),
  rejectFriend: (id) => request(`/api/friends/requests/${id}/reject`, { method: 'POST' }),
  removeFriend: (id) => request(`/api/friends/${id}`, { method: 'DELETE' }),

  conversations: () => request('/api/conversations'),
  conversation: (id) => request(`/api/conversations/${encodeURIComponent(id)}`),
  messages: (id, { before = 0, after = 0, limit = 40 } = {}) =>
    request(
      `/api/conversations/${encodeURIComponent(id)}/messages?before=${before}&after=${after}&limit=${limit}`
    ),
  sendMessage: (id, payload) =>
    request(`/api/conversations/${encodeURIComponent(id)}/messages`, { method: 'POST', body: payload }),
  markRead: (id, seq) =>
    request(`/api/conversations/${encodeURIComponent(id)}/read`, { method: 'POST', body: { seq } }),
  typing: (id) => request(`/api/conversations/${encodeURIComponent(id)}/typing`, { method: 'POST' }),

  upload: (blob) => request('/api/upload', { method: 'POST', raw: blob }),
};

/** 把手机拍的大图压到合理尺寸，既快又省流量 */
export async function compressImage(file, maxDim = 1600, quality = 0.86) {
  if (!file || !file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 900 * 1024) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    return blob || file;
  } catch {
    return file;
  }
}
