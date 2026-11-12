import { h, clear, qs, attachPointerGlow } from './dom.js';
import { api, getToken, setToken, getTheme, setTheme } from './api.js';
import {
  state,
  on,
  emit,
  resetState,
  sortConversations,
  conversationById,
  unreadTotal,
} from './store.js';
import { connectSocket } from './socket.js';
import { icon } from './icons.js';
import { toast, badge, haptic } from './ui.js';
import { previewOf } from './format.js';
import { renderAuth } from './views/auth.js';
import { renderChats } from './views/chats.js';
import { renderChat } from './views/chat.js';
import { renderFriends } from './views/friends.js';
import { renderMe, notificationsEnabled } from './views/me.js';
import { renderMoments } from './views/moments.js';
import { openAddFriend, openCreateGroup } from './views/sheets.js';
import { applyAppearance } from './prefs.js';

const viewport = qs('#viewport');
const tabbar = qs('#tabbar');

let socket = null;
let currentView = null;
let currentRoute = '';
let theme = getTheme();

/* ─────────────── 主题 ─────────────── */

function resolveDark(value) {
  if (value === 'dark') return true;
  if (value === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(value) {
  theme = value;
  setTheme(value);
  document.documentElement.dataset.theme = resolveDark(value) ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolveDark(value) ? '#04060c' : '#eef5ff');
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (theme === 'auto') applyTheme('auto');
});

/* ─────────────── 键盘 / 视口 ─────────────── */

function applyViewportHeight() {
  const vv = window.visualViewport;
  if (!vv) return;
  const hidden = window.innerHeight - vv.height;
  // 键盘弹出时把整个壳压到可见区域，输入框不会被挡住
  document.documentElement.style.setProperty(
    '--app-h',
    hidden > 120 ? `${Math.round(vv.height)}px` : '100dvh'
  );
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', applyViewportHeight);
  window.visualViewport.addEventListener('scroll', applyViewportHeight);
}
window.addEventListener('orientationchange', () => setTimeout(applyViewportHeight, 250));
window.addEventListener('resize', applyViewportHeight);

/* ─────────────── 标题 / 标签栏 ─────────────── */

function updateTitle() {
  const n = unreadTotal();
  document.title = n ? `(${n}) 鲸语` : '鲸语';
}

const TABS = [
  { id: 'chats', label: '消息', icon: 'message', iconActive: 'message-fill' },
  { id: 'friends', label: '好友', icon: 'people', iconActive: 'people-fill' },
  { id: 'moments', label: '朋友圈', icon: 'sparkles', iconActive: 'sparkles' },
  { id: 'me', label: '我', icon: 'person', iconActive: 'person-fill' },
];

function renderTabbar() {
  if (!tabbar) return;
  const active = currentRoute.startsWith('#/chat/') ? 'chats' : currentRoute.split('/')[1] || 'chats';
  clear(tabbar);
  tabbar.hidden = currentRoute.startsWith('#/chat/') || currentRoute === '#/auth';
  for (const tab of TABS) {
    const isActive = tab.id === active;
    const iconWrap = h('span', { class: 'tab__icon' }, icon(isActive ? tab.iconActive : tab.icon, { size: 23, stroke: 1.7 }));
    if (tab.id === 'chats') {
      const unread = unreadTotal();
      if (unread) iconWrap.append(badge(unread));
    }
    if (tab.id === 'friends' && state.incoming.length) {
      iconWrap.append(badge(state.incoming.length));
    }
    tabbar.append(
      h(
        'button',
        {
          class: `tab ${isActive ? 'is-active' : ''}`,
          'aria-label': tab.label,
          'aria-current': isActive ? 'page' : 'false',
          onclick: () => go(`#/${tab.id}`),
        },
        iconWrap,
        h('span', { text: tab.label })
      )
    );
  }
}

/* ─────────────── 导航 ─────────────── */

function go(hash) {
  if (location.hash === hash) {
    route();
    return;
  }
  location.hash = hash;
}

function mount(view) {
  currentView?.destroy?.();
  currentView = view;
  clear(viewport).append(view.el);
}

function showAuth() {
  socket?.close();
  socket = null;
  currentView?.destroy?.();
  currentView = null;
  currentRoute = '#/auth';
  clear(viewport).append(renderAuth({ config: state.config, onSuccess: onAuthed }));
  if (tabbar) tabbar.hidden = true;
  document.title = '鲸语';
}

function renderRoute() {
  const hash = location.hash || '#/chats';
  if (!getToken()) {
    if (currentRoute !== '#/auth') showAuth();
    return;
  }
  if (hash === '#/auth') {
    go('#/chats');
    return;
  }

  currentRoute = hash;
  const parts = hash.replace(/^#\//, '').split('/');
  let view;

  if (parts[0] === 'chat' && parts[1]) {
    view = renderChat({ convId: decodeURIComponent(parts[1]), onBack: () => go('#/chats') });
  } else if (parts[0] === 'friends') {
    view = renderFriends({
      onOpenChat: (id) => go(`#/chat/${id}`),
      onAddFriend: openAddFriendSheet,
    });
  } else if (parts[0] === 'moments') {
    view = renderMoments();
  } else if (parts[0] === 'me') {
    view = renderMe({
      theme,
      onThemeChange: (value) => {
        applyTheme(value);
        renderTabbar();
        toast(value === 'auto' ? '跟随系统外观' : value === 'dark' ? '深色外观' : '浅色外观');
      },
      onLogout: () => handleLogout(false),
    });
  } else {
    view = renderChats({
      onOpen: (id) => go(`#/chat/${id}`),
      onAddFriend: openAddFriendSheet,
      onAddGroup: () =>
        openCreateGroup({
          onCreated: async (id) => {
            await refreshAll();
            go(`#/chat/${id}`);
          },
        }),
    });
  }

  mount(view);
  renderTabbar();
  updateTitle();
  if (currentView?.el) attachPointerGlow(currentView.el);
}

function route() {
  renderRoute();
  // 进入会话后拉一次最新会话列表，保证返回时顺序正确
  if (location.hash.startsWith('#/chat/')) {
    api
      .conversations()
      .then((data) => {
        state.conversations = data.conversations;
        sortConversations();
        renderTabbar();
        updateTitle();
      })
      .catch(() => {});
  }
}

/* ─────────────── 数据 ─────────────── */

async function refreshAll() {
  const [me, conversations, friends] = await Promise.all([
    api.me(),
    api.conversations(),
    api.friends(),
  ]);
  state.me = me.user;
  state.bot = me.bot || state.bot;
  state.conversations = conversations.conversations;
  state.friends = friends.friends;
  state.incoming = friends.requests.incoming;
  state.outgoing = friends.requests.outgoing;

  const online = new Set();
  for (const friend of state.friends) if (friend.online) online.add(friend.id);
  for (const conv of state.conversations) if (conv.peer?.online) online.add(conv.peer.id);
  state.online = online;

  sortConversations();
  state.lastSyncAt = Date.now();
  currentView?.render?.();
  renderTabbar();
  updateTitle();
}

async function refreshConversations() {
  try {
    const [data, me] = await Promise.all([api.conversations(), api.me()]);
    state.conversations = data.conversations;
    state.me = me.user;
    sortConversations();
    if (currentRoute === '#/chats') currentView?.render?.();
    renderTabbar();
    updateTitle();
  } catch {
    /* 静默失败 */
  }
}

async function refreshFriends() {
  try {
    const data = await api.friends();
    state.friends = data.friends;
    state.incoming = data.requests.incoming;
    state.outgoing = data.requests.outgoing;
    for (const friend of state.friends) {
      if (friend.online) state.online.add(friend.id);
    }
    currentView?.render?.();
    renderTabbar();
  } catch {
    /* 静默失败 */
  }
}

async function refreshMe() {
  try {
    const data = await api.me();
    state.me = data.user;
    state.bot = data.bot || state.bot;
    currentView?.render?.();
  } catch {
    /* 静默失败 */
  }
}

/* ─────────────── 实时事件 ─────────────── */

function notifyIncoming(message, peer) {
  if (!document.hidden) return;
  const title = peer?.displayName || '新消息';
  const body = previewOf(message);

  // iOS 壳 / 原生容器：交给原生发本地通知
  const native = window.webkit?.messageHandlers?.whaletalkNotify;
  if (native) {
    try {
      native.postMessage({ title, body, convId: message.convId });
      return;
    } catch {
      /* 回退到 Web 通知 */
    }
  }

  if (!notificationsEnabled()) return;
  try {
    const note = new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
      tag: message.convId,
      silent: false,
    });
    note.onclick = () => {
      window.focus();
      go(`#/chat/${message.convId}`);
      note.close();
    };
  } catch {
    /* 通知失败不影响收消息 */
  }
}

let audioCtx = null;

/** 新消息提示音：短促的两段音，不吵 */
function playPing() {
  if (localStorage.getItem('whaletalk.sound') === '0') return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.09);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.26);
  } catch {
    /* 有些浏览器不让自动播放，忽略 */
  }
}

function handleSocketEvent(msg) {
  switch (msg.t) {
    case 'message': {
      const message = msg.message;
      const conv = conversationById(message.convId);
      const mine = message.senderId === state.me?.id;
      if (conv) {
        conv.lastMessage = message;
        conv.lastMessageAt = message.createdAt;
        if (!mine && state.activeConvId !== message.convId) {
          conv.unread = (conv.unread || 0) + 1;
        }
      }
      sortConversations();
      currentView?.onMessage?.(message);
      if (currentRoute === '#/chats') currentView?.render?.();
      renderTabbar();
      updateTitle();
      if (!mine && (document.hidden || state.activeConvId !== message.convId)) {
        playPing();
      }
      if (!mine && document.hidden) {
        notifyIncoming(message, conv?.peer || state.bot);
      } else if (!mine && state.activeConvId !== message.convId) {
        haptic(12);
      }
      break;
    }
    case 'typing': {
      state.typing.set(msg.convId, { userId: msg.userId, until: Date.now() + 4000 });
      currentView?.onTyping?.(msg.userId, msg.convId);
      if (currentRoute === '#/chats') currentView?.render?.();
      break;
    }
    case 'presence': {
      if (msg.online) state.online.add(msg.userId);
      else state.online.delete(msg.userId);
      currentView?.onPresence?.(msg.userId, msg.online);
      if (!currentRoute.startsWith('#/chat/')) currentView?.render?.();
      break;
    }
    case 'read': {
      state.peerRead.set(msg.convId, Math.max(state.peerRead.get(msg.convId) || 0, msg.seq));
      currentView?.onRead?.(msg.userId, msg.seq);
      break;
    }
    case 'friend-request': {
      toast(`${msg.request?.user?.displayName || '有人'} 想加你为好友`, { duration: 3200 });
      haptic([10, 40, 10]);
      refreshFriends();
      break;
    }
    case 'friend-accepted': {
      toast(`${msg.friend?.displayName || '对方'} 通过了你的好友申请`, { type: 'success' });
      refreshAll().catch(() => {});
      break;
    }
    case 'friend-removed': {
      toast('对方解除了好友关系');
      refreshAll().catch(() => {});
      break;
    }
    case 'reconnected': {
      refreshAll().catch(() => {});
      break;
    }
    default:
      break;
  }
}

function connect() {
  if (!getToken()) return;
  socket?.close();
  socket = connectSocket({
    token: getToken(),
    onState: (next) => {
      state.wsState = next;
      if (currentRoute === '#/chats') currentView?.render?.();
      if (currentRoute === '#/me') currentView?.render?.();
    },
    onEvent: handleSocketEvent,
  });
}

/* ─────────────── 登录 / 退出 ─────────────── */

async function onAuthed() {
  try {
    await refreshAll();
  } catch (err) {
    toast(err.message || '加载失败', { type: 'error' });
  }
  connect();
  if (!location.hash || location.hash === '#/auth') {
    history.replaceState(null, '', '#/chats');
  }
  renderRoute();
}

async function handleLogout(silent) {
  try {
    await api.logout();
  } catch {
    /* 忽略 */
  }
  setToken('');
  socket?.close();
  socket = null;
  resetState();
  history.replaceState(null, '', '#/auth');
  showAuth();
  if (!silent) toast('已经退出登录');
}

/* ─────────────── 加好友弹层 ─────────────── */

function openAddFriendSheet() {
  openAddFriend({
    onOpenChat: (convId) => go(`#/chat/${convId}`),
    onAdded: () => refreshAll().catch(() => {}),
  });
}

/* ─────────────── 全局事件 ─────────────── */

window.addEventListener('hashchange', route);
window.addEventListener('whaletalk:unauthorized', () => handleLogout(true));
window.addEventListener('whaletalk:refresh-all', () => refreshAll().catch(() => {}));
window.addEventListener('whaletalk:refresh-friends', () => refreshFriends());
window.addEventListener('whaletalk:refresh-me', () => refreshMe());
window.addEventListener('whaletalk:refresh-conversations', () => refreshConversations());
window.addEventListener('whaletalk:open-add-friend', openAddFriendSheet);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && getToken()) {
    refreshConversations();
  }
});

window.addEventListener('online', () => {
  if (getToken()) {
    connect();
    refreshAll().catch(() => {});
  }
});

/* ─────────────── 启动 ─────────────── */

async function boot() {
  applyTheme(theme);
  applyAppearance();
  applyViewportHeight();
  attachPointerGlow(document.body);

  try {
    state.config = await api.config();
    state.bot = state.config?.bot || null;
  } catch {
    /* 配置拿不到也能继续 */
  }

  if (!getToken()) {
    showAuth();
    return;
  }

  try {
    await refreshAll();
  } catch (err) {
    if (err.status === 401) {
      setToken('');
      showAuth();
      return;
    }
    // 服务器暂时不可达：先离线进入，稍后自动重连
    toast('暂时连不上服务器，正在重试…', { type: 'error' });
  }

  if (!location.hash || location.hash === '#/auth') {
    history.replaceState(null, '', '#/chats');
  }
  renderRoute();
  connect();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

boot();
