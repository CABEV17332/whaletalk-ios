import { h, clear, nextTick } from '../dom.js';
import { state, conversationById } from '../store.js';
import { api, compressImage } from '../api.js';
import { icon } from '../icons.js';
import { avatar, toast, haptic } from '../ui.js';
import { dayLabel, messageTime, isSameDay, linkify, relativeSeen } from '../format.js';
import { openPeerSheet, openImageSheet, openGroupInfo } from './sheets.js';

/** 单个会话 */
export function renderChat({ convId, onBack }) {
  const conv = conversationById(convId);
  if (!conv) {
    return {
      el: h(
        'div',
        { class: 'screen screen--push' },
        h(
          'div',
          { class: 'auth' },
          h('div', { class: 'empty__orb', text: '🫧' }),
          h('div', { class: 'empty__title', text: '找不到这个会话' }),
          h('button', { class: 'btn btn--glass btn--sm', onclick: onBack }, '返回')
        )
      ),
      destroy() {},
      onMessage() {},
      onTyping() {},
      onPresence() {},
      onRead() {},
    };
  }

  const isGroup = conv.kind === 'group';
  const memberMap = new Map((conv.members || []).map((member) => [member.id, member]));
  let peer = isGroup
    ? { id: `group:${conv.id}`, displayName: conv.title || '群聊', avatarEmoji: '👥', avatarHue: 210, isBot: false }
    : conv.peer;
  let messages = [];
  let hasMore = false;
  let loadingOlder = false;
  let peerReadSeq = state.peerRead.get(convId) || 0;
  let typingUntil = 0;
  let typingUserId = null;
  let stick = true;
  let destroyed = false;
  let readTimer = null;
  let typingSentAt = 0;

  /* ── 顶部导航 ── */
  const headerAvatar = avatar(peer, { size: 'sm', online: peer.isBot || state.online.has(peer.id), showStatus: true });
  const headerName = h('div', { class: 'chat-nav__name ellipsis', text: peer.displayName });
  const headerStatus = h('div', { class: 'chat-nav__status' });

  const header = h(
    'header',
    { class: 'chat-nav' },
    h(
      'button',
      {
        class: 'icon-btn icon-btn--plain',
        'aria-label': '返回',
        onclick: () => onBack?.(),
      },
      icon('chevron-left', { size: 24, stroke: 2.1 })
    ),
    h(
      'div',
      { class: 'chat-nav__who' },
      headerAvatar,
      h('div', { class: 'col', style: { gap: '0' } }, headerName, headerStatus)
    ),
    h(
      'button',
      {
        class: 'icon-btn icon-btn--plain',
        'aria-label': '会话信息',
        onclick: () =>
          isGroup
            ? openGroupInfo({
                conv,
                onChanged: (members) => {
                  conv.members = members;
                  updateHeader();
                },
                onLeft: () => onBack?.(),
              })
            : openPeerSheet({ peer }),
      },
      icon('more', { size: 20 })
    )
  );

  /* ── 消息区 ── */
  const list = h('div', { class: 'messages', role: 'log', 'aria-live': 'polite' });

  const jumpBtn = h(
    'button',
    {
      class: 'chip chip--accent',
      style: {
        position: 'absolute',
        right: '14px',
        bottom: '86px',
        display: 'none',
        zIndex: '15',
        boxShadow: 'var(--glass-shadow)',
      },
      onclick: () => {
        stick = true;
        list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
        jumpBtn.style.display = 'none';
      },
    },
    '有新消息'
  );

  /* ── 输入区 ── */
  const fileInput = h('input', {
    type: 'file',
    accept: 'image/*',
    class: 'sr-only',
    onchange: (event) => pickImage(event.target.files?.[0]),
  });
  const textarea = h('textarea', {
    rows: '1',
    placeholder: peer.isBot ? '跟大肥鱼说点什么…' : '说点什么…',
    'aria-label': '输入消息',
    enterkeyhint: 'send',
  });
  const sendBtn = h(
    'button',
    { class: 'send-btn', disabled: true, 'aria-label': '发送' },
    icon('arrow-up', { size: 18, stroke: 2.4 })
  );
  const cameraBtn = h(
    'button',
    { class: 'composer__btn', 'aria-label': '发送图片' },
    icon('camera', { size: 21 })
  );

  const stickerBtn = h(
    'button',
    { class: 'composer__btn', 'aria-label': '表情包', type: 'button' },
    icon('sticker', { size: 21 })
  );

  const stickerGrid = h('div', { class: 'sticker-grid' });
  let stickerTab = 'builtin';

  const tabBuiltin = h('button', { class: 'sticker-tab is-active', type: 'button' }, '内置');
  const tabMine = h('button', { class: 'sticker-tab', type: 'button' }, '我的');
  tabBuiltin.addEventListener('click', () => {
    stickerTab = 'builtin';
    tabBuiltin.classList.add('is-active');
    tabMine.classList.remove('is-active');
    renderStickerPanel();
  });
  tabMine.addEventListener('click', () => {
    stickerTab = 'mine';
    tabMine.classList.add('is-active');
    tabBuiltin.classList.remove('is-active');
    renderStickerPanel();
  });

  const stickerPanel = h(
    'div',
    { class: 'sticker-layer', hidden: true },
    h('div', { class: 'sticker-scrim', onclick: () => toggleStickerPanel(false) }),
    h(
      'div',
      { class: 'sticker-sheet' },
      h('div', { class: 'sticker-grabber' }),
      h(
        'div',
        { class: 'sticker-panel__head' },
        h('div', { class: 'sticker-tabs' }, tabBuiltin, tabMine),
        h(
          'button',
          { class: 'sticker-panel__add', type: 'button', onclick: () => customStickerInput.click() },
          '+ 添加'
        )
      ),
      stickerGrid
    )
  );

  const customStickerInput = h('input', {
    type: 'file',
    accept: 'image/*',
    class: 'sr-only',
    onchange: (event) => addCustomSticker(event.target.files?.[0]),
  });

  const composer = h(
    'div',
    { class: 'composer' },
    h(
      'div',
      { class: 'composer__inner' },
      cameraBtn,
      stickerBtn,
      textarea,
      h('div', { class: 'composer__actions' }, sendBtn)
    )
  );

  const screen = h(
    'div',
    { class: 'screen screen--push screen--chat' },
    header,
    h('div', { style: { position: 'relative', flex: '1', minHeight: '0', display: 'flex' } }, list, jumpBtn),
    stickerPanel,
    composer,
    fileInput,
    customStickerInput
  );

  /* ── 渲染消息 ── */
  function renderMessages({ animateId = null } = {}) {
    const fragment = document.createDocumentFragment();
    let lastDay = 0;
    let lastSender = null;
    let lastTs = 0;

    messages.forEach((msg, index) => {
      const previous = messages[index - 1];
      const newDay = !isSameDay(msg.createdAt, lastDay);
      const gap = previous ? msg.createdAt - previous.createdAt : Infinity;

      // 微信式时间：跨天或间隔超过 10 分钟，居中显示一次
      if (index === 0 || newDay || gap >= 10 * 60_000) {
        const label =
          newDay && dayLabel(msg.createdAt) !== '今天'
            ? `${dayLabel(msg.createdAt)} ${messageTime(msg.createdAt)}`
            : messageTime(msg.createdAt);
        fragment.append(h('div', { class: 'time-sep' }, h('span', { text: label })));
      }

      if (newDay) {
        lastDay = msg.createdAt;
        lastSender = null;
      }

      const grouped = msg.senderId === lastSender && msg.createdAt - lastTs < 5 * 60_000;
      const next = messages[index + 1];
      const isGroupEnd =
        !next ||
        next.senderId !== msg.senderId ||
        next.createdAt - msg.createdAt > 5 * 60_000 ||
        !isSameDay(next.createdAt, msg.createdAt);
      const mine = msg.senderId === state.me?.id;

      const isSticker = Boolean(msg.meta?.sticker);
      const bubble =
        msg.kind === 'image'
          ? h(
              'div',
              { class: `bubble bubble--media${isSticker ? ' bubble--sticker' : ''}` },
              h('img', {
                src: msg.meta?.url,
                alt: isSticker ? '表情' : '图片',
                loading: 'lazy',
                decoding: 'async',
                style: !isSticker && msg.meta?.width && msg.meta?.height
                  ? { aspectRatio: `${msg.meta.width} / ${msg.meta.height}` }
                  : null,
                onclick: () => (isSticker ? null : openImageSheet(msg.meta?.url)),
              })
            )
          : h(
              'div',
              { class: `bubble ${mine ? 'bubble--out' : 'bubble--in'}` },
              linkify(msg.body)
            );

      const readLabel =
        mine && isGroupEnd && msg.seq && peerReadSeq >= msg.seq
          ? h('div', { class: 'msg-read', text: '已读' })
          : null;

      const sender = mine ? state.me : isGroup ? memberMap.get(msg.senderId) || peer : peer;
      const senderName =
        isGroup && !mine && !grouped
          ? h('div', { class: 'msg-sender', text: sender?.displayName || '群成员' })
          : null;

      const row = h(
        'div',
        {
          class: [
            'msg-row',
            mine ? 'msg-row--out' : 'msg-row--in',
            grouped ? 'msg-row--grouped' : 'msg-row--first',
            msg.id === animateId ? 'msg-row--new' : '',
          ]
            .filter(Boolean)
            .join(' '),
          dataset: { id: msg.id },
        },
        mine
          ? null
          : h('div', { class: 'msg-avatar' }, avatar(sender, { size: 'xs', online: false })),
        h('div', { class: 'msg-body' }, senderName, bubble, readLabel)
      );

      fragment.append(row);
      lastSender = msg.senderId;
      lastTs = msg.createdAt;
    });

    if (typingUntil > Date.now()) fragment.append(typingRow());

    if (!messages.length) {
      fragment.append(
        h(
          'div',
          { class: 'empty', style: { paddingTop: '30px' } },
          h('div', { class: 'empty__orb', text: peer.isBot ? '🐳' : '👋' }),
          h('div', { class: 'empty__title', text: `和 ${peer.displayName} 打个招呼吧` }),
          h('div', { class: 'text-sm faint', text: peer.isBot ? '大肥鱼会一直在这里等你' : '第一句话最难开口啦' })
        )
      );
    }

    clear(list).append(fragment);
    updateHeader();
  }

  function typingRow() {
    const who = isGroup
      ? memberMap.get(typingUserId)?.displayName || '有人'
      : peer.displayName;
    return h(
      'div',
      { class: 'msg-typing', dataset: { typing: '1' } },
      h('div', { class: 'msg-typing__bubble' }, h('div', { class: 'typing' }, h('i'), h('i'), h('i'))),
      h('span', { text: `${who} 正在输入` })
    );
  }

  function updateHeader() {
    if (isGroup) {
      headerStatus.textContent =
        typingUntil > Date.now()
          ? `${memberMap.get(typingUserId)?.displayName || '有人'} 正在输入…`
          : `${(conv.members || []).length} 人`;
      headerStatus.classList.remove('is-online');
      headerAvatar.querySelector('.avatar__dot')?.remove();
      return;
    }
    const online = peer.isBot || state.online.has(peer.id);
    headerStatus.textContent =
      typingUntil > Date.now()
        ? '正在输入…'
        : peer.isBot
          ? 'AI 好友 · 在线'
          : online
            ? '在线'
            : relativeSeen(peer.lastSeenAt);
    headerStatus.classList.toggle('is-online', online || peer.isBot);
    headerAvatar.querySelector('.avatar__dot')?.remove();
    if (online) {
      const dot = document.createElement('div');
      dot.className = 'avatar__dot';
      headerAvatar.append(dot);
    }
  }

  function scrollBottom(behavior = 'auto') {
    list.scrollTo({ top: list.scrollHeight, behavior });
  }

  function scheduleRead() {
    clearTimeout(readTimer);
    readTimer = setTimeout(async () => {
      const lastSeq = messages.at(-1)?.seq || 0;
      if (!lastSeq) return;
      try {
        await api.markRead(convId, lastSeq);
        conv.unread = 0;
        window.dispatchEvent(new CustomEvent('whaletalk:refresh-conversations'));
      } catch {
        /* 已读失败不重要 */
      }
    }, 500);
  }

  function upsertMessage(msg) {
    const index = messages.findIndex(
      (item) => item.id === msg.id || (msg.clientId && item.clientId === msg.clientId)
    );
    if (index >= 0) {
      messages[index] = { ...messages[index], ...msg };
    } else {
      messages.push(msg);
      messages.sort((a, b) => (a.seq || 0) - (b.seq || 0) || a.createdAt - b.createdAt);
    }
  }

  /* ── 载入 ── */
  async function load() {
    try {
      const page = await api.messages(convId, { limit: 40 });
      messages = page.messages;
      hasMore = page.hasMore;
      if (page.peer) {
        peer = page.peer;
        conv.peer = page.peer;
        headerName.textContent = page.peer.displayName;
      }
      renderMessages();
      await nextTick();
      scrollBottom();
      stick = true;
      scheduleRead();
    } catch (err) {
      toast(err.message, { type: 'error' });
    }
  }

  async function loadOlder() {
    if (loadingOlder || !hasMore) return;
    loadingOlder = true;
    const anchor = messages[0]?.seq || 0;
    const prevHeight = list.scrollHeight;
    const prevTop = list.scrollTop;
    try {
      const page = await api.messages(convId, { before: anchor, limit: 40 });
      if (page.messages.length) {
        messages = [...page.messages, ...messages];
        hasMore = page.hasMore;
        renderMessages();
        await nextTick();
        list.scrollTop = list.scrollHeight - prevHeight + prevTop;
      } else {
        hasMore = false;
      }
    } catch (err) {
      toast(err.message, { type: 'error' });
    } finally {
      loadingOlder = false;
    }
  }

  /* ── 发送 ── */
  function autosize() {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(132, textarea.scrollHeight)}px`;
    sendBtn.disabled = !textarea.value.trim();
  }

  function makeClientId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async function sendText() {
    const text = textarea.value.trim();
    if (!text) return;
    toggleStickerPanel(false);
    textarea.value = '';
    autosize();
    sendBtn.disabled = true;
    const clientId = makeClientId();
    try {
      const res = await api.sendMessage(convId, { kind: 'text', body: text, clientId });
      upsertMessage(res.message);
      renderMessages({ animateId: res.message.id });
      stick = true;
      scrollBottom('smooth');
      scheduleRead();
      haptic(6);
    } catch (err) {
      textarea.value = text;
      autosize();
      toast(err.message, { type: 'error' });
    }
  }

  async function pickImage(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('只能发图片哦', { type: 'error' });
      return;
    }
    cameraBtn.disabled = true;
    cameraBtn.style.opacity = '0.4';
    try {
      toast('图片上传中…', { duration: 1200 });
      const blob = await compressImage(file);
      const uploaded = await api.upload(blob);
      const res = await api.sendMessage(convId, {
        kind: 'image',
        clientId: makeClientId(),
        meta: {
          url: uploaded.url,
          width: uploaded.width,
          height: uploaded.height,
          mime: uploaded.mime,
        },
      });
      upsertMessage(res.message);
      renderMessages({ animateId: res.message.id });
      stick = true;
      scrollBottom('smooth');
    } catch (err) {
      toast(err.message, { type: 'error' });
    } finally {
      cameraBtn.disabled = false;
      cameraBtn.style.opacity = '';
      fileInput.value = '';
    }
  }

  /* ── 表情包 ── */
  const CUSTOM_KEY = 'whaletalk.stickers';
  let builtinStickers = [];
  let customStickers = loadCustomStickers();

  function loadCustomStickers() {
    try {
      const list = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
      return Array.isArray(list) ? list.slice(0, 30) : [];
    } catch {
      return [];
    }
  }

  function saveCustomStickers() {
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(customStickers.slice(0, 30)));
    } catch {
      /* 存不下不影响发送 */
    }
  }

  function renderStickerPanel() {
    clear(stickerGrid);
    const source =
      stickerTab === 'builtin' ? builtinStickers.map((item) => ({ ...item, url: item.file })) : customStickers;
    if (!source.length) {
      stickerGrid.append(
        h('div', { class: 'sticker-empty', text: stickerTab === 'builtin' ? '表情加载中…' : '还没有收藏，点右上角 + 添加' })
      );
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const item of source) {
      fragment.append(
        h(
          'button',
          {
            class: 'sticker-item',
            type: 'button',
            title: item.label || '表情',
            onclick: () => sendSticker(item),
          },
          h('img', { src: item.url, alt: item.label || '表情', loading: 'lazy', decoding: 'async' })
        )
      );
    }
    if (stickerTab === 'mine') {
      fragment.append(
        h(
          'button',
          { class: 'sticker-add-tile', type: 'button', title: '添加表情', onclick: () => customStickerInput.click() },
          '+'
        )
      );
    }
    stickerGrid.append(fragment);
  }

  function toggleStickerPanel(force) {
    const show = force ?? stickerPanel.hidden;
    stickerPanel.hidden = !show;
    stickerBtn.classList.toggle('is-active', show);
    if (show) {
      renderStickerPanel();
      textarea.blur();
    }
  }

  async function sendSticker(item) {
    toggleStickerPanel(false);
    try {
      const res = await api.sendMessage(convId, {
        kind: 'image',
        clientId: makeClientId(),
        meta: { url: item.url, width: item.width || 512, height: item.height || 512, sticker: true },
      });
      upsertMessage(res.message);
      renderMessages({ animateId: res.message.id });
      stick = true;
      scrollBottom('smooth');
      scheduleRead();
      haptic(6);
    } catch (err) {
      toast(err.message, { type: 'error' });
    }
  }

  async function addCustomSticker(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('只能收藏图片', { type: 'error' });
      return;
    }
    try {
      toast('收藏中…', { duration: 1200 });
      const blob = await compressImage(file, 512, 0.92);
      const uploaded = await api.upload(blob);
      customStickers.unshift({
        url: uploaded.url,
        width: uploaded.width || 512,
        height: uploaded.height || 512,
        label: '我的',
      });
      customStickers = customStickers.slice(0, 30);
      saveCustomStickers();
      toggleStickerPanel(true);
    } catch (err) {
      toast(err.message, { type: 'error' });
    } finally {
      customStickerInput.value = '';
    }
  }

  function loadBuiltinStickers() {
    fetch('/stickers/index.json', { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        builtinStickers = Array.isArray(data?.stickers) ? data.stickers : [];
        if (!stickerPanel.hidden) renderStickerPanel();
      })
      .catch(() => {});
  }

  function onDocPointerDown(event) {
    if (stickerPanel.hidden) return;
    if (stickerPanel.contains(event.target) || stickerBtn.contains(event.target)) return;
    toggleStickerPanel(false);
  }

  document.addEventListener('pointerdown', onDocPointerDown);
  stickerBtn.addEventListener('click', () => toggleStickerPanel());

  cameraBtn.addEventListener('click', () => fileInput.click());
  sendBtn.addEventListener('click', sendText);
  textarea.addEventListener('focus', () => {
    setTimeout(() => {
      if (stick) scrollBottom();
    }, 280);
  });

  textarea.addEventListener('input', () => {
    autosize();
    if (Date.now() - typingSentAt > 2400) {
      typingSentAt = Date.now();
      api.typing(convId).catch(() => {});
    }
  });
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !event.ctrlKey) {
      event.preventDefault();
      sendText();
    }
  });

  /* ── 滚动 ── */
  list.addEventListener('scroll', () => {
    const distance = list.scrollHeight - list.scrollTop - list.clientHeight;
    const wasStick = stick;
    stick = distance < 90;
    if (wasStick && !stick) header.classList.add('is-scrolled');
    header.classList.toggle('is-scrolled', list.scrollTop > 8 || !stick);
    if (stick) jumpBtn.style.display = 'none';
    if (list.scrollTop < 80 && hasMore && !loadingOlder) loadOlder();
  });

  /* ── 外部事件 ── */
  function onMessage(message) {
    if (destroyed || message.convId !== convId) return;
    const isNew = !messages.some((item) => item.id === message.id);
    if (!isNew) return;
    upsertMessage(message);
    const wasStick = stick;
    renderMessages({ animateId: message.id });
    if (wasStick) {
      scrollBottom('smooth');
      scheduleRead();
    } else {
      jumpBtn.style.display = 'inline-flex';
      scheduleRead();
    }
  }

  function onTyping(userId) {
    if (destroyed) return;
    if (isGroup) {
      if (userId === state.me?.id || !memberMap.has(userId)) return;
      typingUserId = userId;
      typingUntil = Date.now() + 3600;
      updateHeader();
      renderMessages();
      if (stick) scrollBottom();
      setTimeout(() => {
        if (destroyed) return;
        if (Date.now() >= typingUntil) {
          updateHeader();
          renderMessages();
          if (stick) scrollBottom();
        }
      }, 3700);
      return;
    }
    if (userId !== peer.id) return;
    typingUntil = Date.now() + 3600;
    renderMessages();
    if (stick) scrollBottom();
    setTimeout(() => {
      if (destroyed) return;
      if (Date.now() >= typingUntil) {
        renderMessages();
        if (stick) scrollBottom();
      }
    }, 3700);
  }

  function onPresence(userId, online) {
    if (isGroup) return;
    if (destroyed || userId !== peer.id) return;
    updateHeader();
    if (online) {
      // 重新拉一次最近消息，避免断线期间漏消息
      api.messages(convId, { limit: 20 }).then((page) => {
        for (const message of page.messages) upsertMessage(message);
        renderMessages();
        if (stick) scrollBottom();
      }).catch(() => {});
    }
  }

  function onRead(userId, seq) {
    if (destroyed || userId !== peer.id) return;
    peerReadSeq = Math.max(peerReadSeq, Number(seq) || 0);
    state.peerRead.set(convId, peerReadSeq);
    renderMessages();
    if (stick) scrollBottom();
  }

  function destroy() {
    destroyed = true;
    clearTimeout(readTimer);
    document.removeEventListener('pointerdown', onDocPointerDown);
    state.activeConvId = null;
  }

  autosize();
  updateHeader();
  loadBuiltinStickers();
  load();
  state.activeConvId = convId;

  return { el: screen, onMessage, onTyping, onPresence, onRead, destroy, refresh: load };
}
