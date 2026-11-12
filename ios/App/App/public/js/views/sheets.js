import { h, clear } from '../dom.js';
import { api } from '../api.js';
import { state } from '../store.js';
import { icon } from '../icons.js';
import { avatar, openSheet, toast, confirmSheet } from '../ui.js';

/** 用户资料卡 */
export function openPeerSheet({ peer, onOpen }) {
  const isFriend = state.friends.some((friend) => friend.id === peer.id);
  const conv = state.conversations.find((item) => item.peer?.id === peer.id);

  const handle = openSheet({
    title: '资料',
    content: h(
      'div',
      { class: 'stack', style: { gap: '16px', alignItems: 'center', paddingBottom: '6px' } },
      avatar(peer, { size: 'xl', online: peer.isBot || state.online.has(peer.id), showStatus: !peer.isBot }),
      h(
        'div',
        { class: 'stack', style: { gap: '4px', alignItems: 'center', textAlign: 'center' } },
        h('div', { class: 'title-md', text: peer.displayName }),
        h('div', { class: 'text-sm faint', text: `@${peer.username}` }),
        peer.bio ? h('p', { class: 'text-sm muted', style: { marginTop: '4px' }, text: peer.bio }) : null,
        peer.isBot
          ? h('span', { class: 'chip chip--accent', text: 'AI 好友 · 住在服务器里' })
          : null
      ),
      h(
        'div',
        { class: 'row', style: { width: '100%', gap: '10px' } },
        h(
          'button',
          {
            class: 'btn btn--primary grow',
            onclick: () => {
              handle.close();
              onOpen?.();
            },
          },
          conv ? '发消息' : '开始聊天'
        )
      ),
      isFriend && !peer.isBot
        ? h(
            'button',
            {
              class: 'btn btn--danger btn--block',
              onclick: async () => {
                handle.close();
                const ok = await confirmSheet({
                  title: '删除好友',
                  message: `确定要和 ${peer.displayName} 解除好友关系吗？聊天记录会保留，但不会再出现在列表里。`,
                  confirmText: '删除',
                  danger: true,
                });
                if (!ok) return;
                try {
                  await api.removeFriend(peer.id);
                  toast('已删除好友');
                  window.dispatchEvent(new CustomEvent('whaletalk:refresh-all'));
                } catch (err) {
                  toast(err.message, { type: 'error' });
                }
              },
            },
            '解除好友关系'
          )
        : null
    ),
  });
  return handle;
}

/** 只看大图 */
export function openImageSheet(url) {
  const handle = openSheet({
    title: '图片',
    content: h('img', {
      src: url,
      alt: '图片',
      style: {
        width: '100%',
        borderRadius: '20px',
        maxHeight: '68dvh',
        objectFit: 'contain',
        background: 'var(--glass-fill-soft)',
      },
    }),
  });
  return handle;
}

/** 加好友：搜索 + 一键申请 */
export function openAddFriend({ onOpenChat, onAdded } = {}) {
  const input = h('input', {
    type: 'search',
    placeholder: '搜用户名，或输入 @名字',
    autocomplete: 'off',
    autocapitalize: 'none',
    spellcheck: 'false',
    'aria-label': '搜索用户',
  });
  const results = h('div', { style: { marginTop: '12px' } });

  let timer = null;
  let seq = 0;

  async function search(term) {
    const current = ++seq;
    clear(results);
    if (!term) {
      results.append(botCard());
      return;
    }
    results.append(
      h('div', { class: 'row center', style: { padding: '22px', color: 'var(--ink-3)' } }, h('span', { class: 'spinner' }))
    );
    try {
      const data = await api.searchUsers(term);
      if (current !== seq) return;
      clear(results);
      if (!data.results.length) {
        results.append(
          h(
            'div',
            { class: 'empty', style: { padding: '28px 10px' } },
            h('div', { class: 'empty__orb', style: { width: '54px', height: '54px', fontSize: '24px' }, text: '🔍' }),
            h('div', { class: 'empty__title', text: '没有找到这个人' }),
            h('div', { class: 'text-sm faint', text: '用户名要完全对得上，或试试昵称关键字' })
          )
        );
        return;
      }
      for (const user of data.results) results.append(userRow(user));
    } catch (err) {
      if (current !== seq) return;
      clear(results).append(h('div', { class: 'auth__error', text: err.message }));
    }
  }

  function botCard() {
    const bot = state.bot;
    if (!bot) return h('div');
    return h(
      'div',
      { class: 'stack', style: { gap: '8px' } },
      h('div', { class: 'section-label', text: '住在服务器里的朋友' }),
      h(
        'button',
        {
          class: 'quick-add glass glass--thin press',
          onclick: async () => {
            try {
              const res = await api.sendFriendRequest(bot.username, '你好呀大肥鱼');
              toast('大肥鱼已经在等你了', { type: 'success' });
              window.dispatchEvent(new CustomEvent('whaletalk:refresh-all'));
              if (res.conversationId) {
                handle.close();
                onOpenChat?.(res.conversationId);
              }
            } catch (err) {
              toast(err.message, { type: 'error' });
            }
          },
        },
        h('div', { class: 'quick-add__orb', text: '🐳' }),
        h(
          'div',
          { class: 'col grow' },
          h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'title-md', text: bot.displayName }), h('span', { class: 'chip chip--accent', text: 'AI' })),
          h('div', { class: 'text-xs faint', text: `@${bot.username} · 随时在线` })
        ),
        icon('chevron-right', { size: 18 })
      )
    );
  }

  function userRow(user) {
    const action = h('div', { class: 'grow', style: { flex: 'none' } });
    const relation = user.relation || 'none';

    if (relation === 'self') {
      action.append(h('span', { class: 'chip', text: '这是你' }));
    } else if (relation === 'friend') {
      action.append(
        h(
          'button',
          {
            class: 'pill-btn',
            onclick: () => {
              const conv = state.conversations.find((item) => item.peer?.id === user.id);
              handle.close();
              if (conv) onOpenChat?.(conv.id);
              else toast('去消息列表找找吧');
            },
          },
          '发消息'
        )
      );
    } else {
      const button = h(
        'button',
        { class: 'pill-btn' },
        '加好友'
      );
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = '发送中…';
        try {
          const res = await api.sendFriendRequest(user.username);
          if (res.status === 'friends') {
            toast(`你和 ${user.displayName} 已经是好友啦`, { type: 'success' });
            window.dispatchEvent(new CustomEvent('whaletalk:refresh-all'));
            onAdded?.(res);
            if (res.conversationId) {
              handle.close();
              onOpenChat?.(res.conversationId);
            }
          } else {
            button.textContent = '已发送';
            button.classList.add('pill-btn--muted');
            toast('好友申请已经送到啦');
          }
        } catch (err) {
          button.disabled = false;
          button.textContent = '加好友';
          toast(err.message, { type: 'error' });
        }
      });
      action.append(button);
    }

    const online = user.isBot || state.online.has(user.id);
    return h(
      'div',
      { class: 'user-result' },
      avatar(user, { size: 'sm', online, showStatus: true }),
      h(
        'div',
        { class: 'col grow' },
        h(
          'div',
          { class: 'user-result__name' },
          h('span', { class: 'ellipsis', text: user.displayName }),
          user.isBot ? h('span', { class: 'chip chip--accent', text: 'AI' }) : null
        ),
        h('div', { class: 'user-result__sub', text: `@${user.username}` })
      ),
      action
    );
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const term = input.value.trim();
    timer = setTimeout(() => search(term), 260);
  });

  const handle = openSheet({
    title: '添加好友',
    content: h(
      'div',
      null,
      h('label', { class: 'field field--search' }, icon('search', { size: 17 }), input),
      results
    ),
  });

  search('');
  setTimeout(() => input.focus({ preventScroll: true }), 420);
  return handle;
}

/** 编辑我的资料 */
export function openEditProfile({ user, onSaved }) {
  const emojis = ['🐳', '🐟', '🫧', '🌊', '🐚', '🦋', '🌟', '🍥', '🧋', '🌙'];
  let hue = Number(user.avatarHue ?? 210);
  let emoji = user.avatarEmoji || '';

  const preview = h('div', { class: 'avatar avatar--xl', style: { '--h': String(hue) } });
  const previewInner = h('div', { class: 'avatar__inner', text: emoji || user.displayName.slice(0, 2) });
  preview.append(previewInner);

  const nameInput = h('input', { type: 'text', value: user.displayName, maxlength: '24', 'aria-label': '昵称' });
  const bioInput = h('textarea', {
    rows: '3',
    maxlength: '160',
    placeholder: '写一句自我介绍',
    'aria-label': '简介',
    style: { resize: 'none', width: '100%', background: 'none', border: '0', outline: '0', fontSize: '16px' },
  });
  bioInput.value = user.bio || '';

  const emojiRow = h(
    'div',
    { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
    emojis.map((item) =>
      h(
        'button',
        {
          class: 'chip',
          style: { fontSize: '17px', height: '34px', minWidth: '38px', justifyContent: 'center' },
          onclick: () => {
            emoji = item;
            previewInner.textContent = item;
            preview.style.setProperty('--h', String(hue));
          },
        },
        item
      )
    )
  );

  const hueInput = h('input', {
    type: 'range',
    min: '0',
    max: '360',
    value: String(hue),
    style: { width: '100%' },
    'aria-label': '头像颜色',
    oninput: (event) => {
      hue = Number(event.target.value);
      preview.style.setProperty('--h', String(hue));
    },
  });

  const save = h('button', { class: 'btn btn--primary btn--block' }, '保存');

  const handle = openSheet({
    title: '编辑资料',
    content: h(
      'div',
      { class: 'stack', style: { gap: '14px' } },
      h('div', { class: 'center' }, preview),
      emojiRow,
      hueInput,
      h(
        'label',
        { class: 'field' },
        icon('person', { size: 18 }),
        nameInput
      ),
      h('div', { class: 'field', style: { height: 'auto', padding: '10px 16px', alignItems: 'flex-start' } }, bioInput),
      save
    ),
  });

  save.addEventListener('click', async () => {
    save.disabled = true;
    save.textContent = '保存中…';
    try {
      const data = await api.updateMe({
        displayName: nameInput.value.trim() || user.displayName,
        bio: bioInput.value.trim(),
        avatarEmoji: emoji,
        avatarHue: hue,
      });
      toast('资料已更新', { type: 'success' });
      handle.close();
      onSaved?.(data.user);
    } catch (err) {
      toast(err.message, { type: 'error' });
    } finally {
      save.disabled = false;
      save.textContent = '保存';
    }
  });

  return handle;
}
