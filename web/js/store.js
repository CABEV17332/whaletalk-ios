/** 极简全局状态 + 事件总线 */

const listeners = new Map();

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => listeners.get(event)?.delete(handler);
}

export function emit(event, payload) {
  for (const handler of [...(listeners.get(event) || [])]) {
    try {
      handler(payload);
    } catch (err) {
      console.error(`[store] ${event} handler failed`, err);
    }
  }
}

export const state = {
  booted: false,
  me: null,
  bot: null,
  config: null,
  conversations: [],
  friends: [],
  incoming: [],
  outgoing: [],
  online: new Set(),
  typing: new Map(),
  peerRead: new Map(),
  activeConvId: null,
  wsState: 'idle',
  lastSyncAt: 0,
};

export function unreadTotal() {
  return state.conversations.reduce((sum, conv) => sum + (conv.unread || 0), 0);
}

export function conversationById(convId) {
  return state.conversations.find((conv) => conv.id === convId) || null;
}

export function friendById(userId) {
  return state.friends.find((friend) => friend.id === userId) || null;
}

export function isOnline(userId) {
  return state.online.has(userId);
}

export function sortConversations() {
  state.conversations.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
}

export function resetState() {
  state.me = null;
  state.conversations = [];
  state.friends = [];
  state.incoming = [];
  state.outgoing = [];
  state.online = new Set();
  state.typing = new Map();
  state.peerRead = new Map();
  state.activeConvId = null;
  state.wsState = 'idle';
}
