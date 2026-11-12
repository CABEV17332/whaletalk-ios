import { h, clear } from '../dom.js';
import { api, compressImage } from '../api.js';
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
  let avatarUrl = user.avatarUrl || '';
  const previewImg = h('img', {
    class: 'avatar__img',
    src: avatarUrl,
    alt: '头像',
    style: { display: avatarUrl ? '' : 'none' },
  });
  preview.append(previewInner, previewImg);
  if (avatarUrl) previewInner.style.display = 'none';

  const avatarPicker = h('input', { type: 'file', accept: 'image/*', class: 'sr-only' });
  const avatarBtn = h('button', { class: 'chip', type: 'button' }, '更换头像');
  avatarBtn.addEventListener('click', () => avatarPicker.click());
  avatarPicker.addEventListener('change', async () => {
    const file = avatarPicker.files?.[0];
    if (!file) return;
    try {
      avatarBtn.textContent = '上传中…';
      const blob = await compressImage(file, 512, 0.9);
      const uploaded = await api.upload(blob);
      avatarUrl = uploaded.url;
      previewImg.src = avatarUrl;
      previewImg.style.display = '';
      previewInner.style.display = 'none';
      avatarBtn.textContent = '已选择';
    } catch (err) {
      toast(err.message, { type: 'error' });
      avatarBtn.textContent = '更换头像';
    } finally {
      avatarPicker.value = '';
    }
  });

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
            avatarUrl = '';
            previewImg.style.display = 'none';
            previewInner.style.display = '';
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
      h('div', { class: 'center', style: { gap: '8px' } }, avatarBtn, avatarPicker),
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
        avatarUrl,
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

/** 发起群聊：选好友（最多 9 个）+ 群名 */
export function openCreateGroup({ onCreated } = {}) {
  let selected = new Set();
  const title = h('input', { type: 'text', placeholder: '群聊名称', maxlength: '40', 'aria-label': '群聊名称' });
  const list = h('div', { class: 'stack', style: { gap: '6px' } });
  const createBtn = h('button', { class: 'btn btn--primary btn--block', disabled: true }, '创建群聊（0/9）');

  function refresh() {
    clear(list);
    for (const friend of state.friends) {
      if (friend.isBot) continue;
      const checked = selected.has(friend.id);
      list.append(
        h(
          'button',
          {
            class: `list__row ${checked ? 'is-selected' : ''}`,
            type: 'button',
            onclick: () => {
              if (checked) selected.delete(friend.id);
              else if (selected.size < 9) selected.add(friend.id);
              else toast('最多再拉 9 个人');
              refresh();
            },
          },
          avatar(friend, { size: 'xs', online: state.online.has(friend.id) }),
          h('span', { class: 'grow text-sm', text: friend.displayName }),
          checked ? icon('check', { size: 16 }) : null
        )
      );
    }
    createBtn.textContent = `创建群聊（${selected.size}/9）`;
    createBtn.disabled = selected.size === 0;
  }

  createBtn.addEventListener('click', async () => {
    createBtn.disabled = true;
    createBtn.textContent = '创建中…';
    try {
      const data = await api.createGroup({ title: title.value.trim() || '群聊', memberIds: [...selected] });
      handle.close();
      toast('群聊已创建', { type: 'success' });
      onCreated?.(data.conversation.id);
    } catch (err) {
      toast(err.message, { type: 'error' });
      createBtn.disabled = false;
      refresh();
    }
  });

  refresh();

  const handle = openSheet({
    title: '发起群聊',
    content: h(
      'div',
      { class: 'stack', style: { gap: '12px' } },
      h('label', { class: 'field' }, icon('people', { size: 18 }), title),
      h('div', { class: 'text-xs faint', text: '选择好友（群聊最多 10 人）' }),
      list,
      createBtn
    ),
  });
  return handle;
}

/** 群信息：成员列表、邀请、退出 */
export function openGroupInfo({ conv, onChanged, onLeft } = {}) {
  const body = h('div', { class: 'stack', style: { gap: '12px' } });
  let current = conv;

  function render() {
    clear(body);
    const members = current.members || [];
    const isOwner = current.user_a === state.me?.id || current.ownerId === state.me?.id;
    body.append(
      h('div', { class: 'text-sm muted', text: `${members.length} 位成员 · 最多 10 人` }),
      h(
        'div',
        { class: 'stack', style: { gap: '4px' } },
        members.map((member) =>
          h(
            'div',
            { class: 'list__row' },
            avatar(member, { size: 'xs', online: state.online.has(member.id) }),
            h('span', { class: 'grow text-sm', text: member.displayName }),
            member.id === state.me?.id ? h('span', { class: 'text-xs faint', text: '我' }) : null
          )
        )
      )
    );

    if (members.length < 10) {
      body.append(
        h(
          'button',
          {
            class: 'btn btn--glass btn--block',
            onclick: async () => {
              const candidates = state.friends.filter((f) => !members.some((m) => m.id === f.id) && !f.isBot);
              if (!candidates.length) {
                toast('没有可以邀请的好友了');
                return;
              }
              const picker = openSheet({
                title: '邀请好友',
                content: h(
                  'div',
                  { class: 'stack', style: { gap: '4px' } },
                  candidates.map((friend) =>
                    h(
                      'button',
                      {
                        class: 'list__row',
                        onclick: async () => {
                          try {
                            const data = await api.addGroupMember(current.id, friend.id);
                            current = { ...current, members: data.members };
                            picker.close();
                            toast('已加入群聊', { type: 'success' });
                            onChanged?.(data.members);
                            render();
                          } catch (err) {
                            toast(err.message, { type: 'error' });
                          }
                        },
                      },
                      avatar(friend, { size: 'xs' }),
                      h('span', { class: 'grow text-sm', text: friend.displayName })
                    )
                  )
                ),
              });
            },
          },
          '邀请好友'
        )
      );
    }

    if (!isOwner) {
      body.append(
        h(
          'button',
          {
            class: 'btn btn--danger btn--block',
            onclick: async () => {
              const ok = await confirmSheet({ title: '退出群聊', message: '退出后将不再收到群消息', confirmText: '退出', danger: true });
              if (!ok) return;
              try {
                await api.removeGroupMember(current.id, state.me.id);
                handle.close();
                toast('已退出群聊');
                onLeft?.();
              } catch (err) {
                toast(err.message, { type: 'error' });
              }
            },
          },
          '退出群聊'
        )
      );
    }
  }

  render();
  const handle = openSheet({ title: current.title || '群聊', content: body });
  return handle;
}
