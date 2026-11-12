import { h, clear } from '../dom.js';
import { state } from '../store.js';
import { api } from '../api.js';
import { icon } from '../icons.js';
import { avatar, emptyState, toast, confirmSheet } from '../ui.js';
import { timeAgo } from '../format.js';

/** 好友页：待处理申请 + 好友列表 */
export function renderFriends({ onOpenChat, onAddFriend }) {
  const body = h('div');

  const nav = h(
    'header',
    { class: 'nav' },
    h(
      'div',
      { class: 'nav__bar' },
      h('div', { class: 'nav__leading' }),
      h('div', { class: 'nav__compact', text: '好友' }),
      h(
        'div',
        { class: 'nav__trailing' },
        h(
          'button',
          { class: 'icon-btn', 'aria-label': '添加好友', onclick: () => onAddFriend?.() },
          icon('plus', { size: 20 })
        )
      )
    ),
    h(
      'div',
      { class: 'nav__large' },
      h('h1', { class: 'title-xl grow', text: '好友' }),
      h('span', { class: 'text-sm faint', text: `${state.friends.length} 位` })
    )
  );

  const scroll = h('div', { class: 'scroll' }, h('div', { class: 'scroll__inner' }, body));
  scroll.addEventListener('scroll', () => nav.classList.toggle('is-scrolled', scroll.scrollTop > 16));

  async function respond(request, action) {
    try {
      if (action === 'accept') {
        const res = await api.acceptFriend(request.id);
        toast(`你和 ${request.user.displayName} 成为好友啦`, { type: 'success' });
        window.dispatchEvent(new CustomEvent('whaletalk:refresh-all'));
        if (res.conversationId) onOpenChat?.(res.conversationId);
      } else {
        await api.rejectFriend(request.id);
        toast('已忽略这条申请');
        window.dispatchEvent(new CustomEvent('whaletalk:refresh-friends'));
      }
    } catch (err) {
      toast(err.message, { type: 'error' });
    }
  }

  function requestCard(request) {
    return h(
      'div',
      { class: 'request-card glass' },
      h(
        'div',
        { class: 'row' },
        avatar(request.user, { size: 'sm', online: request.user.isBot, showStatus: request.user.isBot }),
        h(
          'div',
          { class: 'col grow' },
          h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'title-md', text: request.user.displayName })),
          h('div', { class: 'text-xs faint', text: `@${request.user.username} · ${timeAgo(request.createdAt)}` })
        )
      ),
      request.message ? h('div', { class: 'request-card__msg', text: request.message }) : null,
      h(
        'div',
        { class: 'row', style: { gap: '8px' } },
        h('button', { class: 'pill-btn pill-btn--muted grow', onclick: () => respond(request, 'reject') }, '忽略'),
        h('button', { class: 'btn btn--primary btn--sm grow', onclick: () => respond(request, 'accept') }, '接受')
      )
    );
  }

  function friendRow(friend) {
    const conv = state.conversations.find((item) => item.peer?.id === friend.id);
    const online = friend.isBot || state.online.has(friend.id);
    return h(
      'button',
      {
        class: 'friend-row',
        onclick: () => {
          if (conv) onOpenChat?.(conv.id);
          else toast('先去消息列表找 TA 吧');
        },
      },
      avatar(friend, { size: 'md', online, showStatus: true }),
      h(
        'div',
        { class: 'col grow' },
        h(
          'div',
          { class: 'row', style: { gap: '6px' } },
          h('span', { class: 'conv__name ellipsis', text: friend.displayName }),
          friend.isBot ? h('span', { class: 'chip chip--accent', text: 'AI' }) : null
        ),
        h('div', { class: 'text-xs faint ellipsis', text: friend.bio || `@${friend.username}` })
      ),
      h('span', { class: 'pill-btn', text: '发消息' })
    );
  }

  function render() {
    clear(body);
    const { incoming, friends } = state;

    if (incoming.length) {
      body.append(h('div', { class: 'section-label', text: `新的朋友 · ${incoming.length}` }));
      for (const request of incoming) body.append(requestCard(request));
      body.append(h('div', { class: 'section-label', text: `好友 · ${friends.length}` }));
    }

    if (!friends.length) {
      body.append(
        emptyState({
          emoji: '🫧',
          title: '还没有好友',
          text: '添加好友后就能开始聊天了',
          action: h(
            'button',
            { class: 'btn btn--primary btn--sm', style: { marginTop: '8px' }, onclick: () => onAddFriend?.() },
            '添加好友'
          ),
        })
      );
    } else {
      const list = h('div', { class: 'list glass', style: { padding: '4px 6px' } });
      for (const friend of friends) list.append(friendRow(friend));
      body.append(list);
    }

    body.append(
      h(
        'div',
        { class: 'auth__hint', style: { marginTop: '18px' } },
        icon('sparkles', { size: 16 }),
        h('span', { text: '把用户名告诉朋友，他们就能在「添加好友」里找到你。' })
      )
    );
  }

  render();
  return { el: h('div', { class: 'screen' }, nav, scroll), render };
}
