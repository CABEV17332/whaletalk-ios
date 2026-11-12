import { h, clear } from '../dom.js';
import { state, unreadTotal } from '../store.js';
import { icon } from '../icons.js';
import { avatar, badge, emptyState } from '../ui.js';
import { timeAgo, previewOf } from '../format.js';

/** 消息列表（首页） */
export function renderChats({ onOpen, onAddFriend }) {
  const list = h('div', { class: 'stack', style: { gap: '0' } });
  const search = h('input', {
    type: 'search',
    placeholder: '搜索聊天',
    autocomplete: 'off',
    'aria-label': '搜索聊天',
  });
  const filter = h(
    'div',
    { class: 'field field--search' },
    icon('search', { size: 17 }),
    search,
    h(
      'button',
      {
        class: 'icon-btn icon-btn--plain',
        style: { width: '24px', height: '24px', display: 'none' },
        'aria-label': '清除',
        onclick: () => {
          search.value = '';
          search.dispatchEvent(new Event('input'));
          search.focus();
        },
      },
      icon('xmark', { size: 15 })
    )
  );
  const clearBtn = filter.lastChild;

  const banner = h('div', {
    class: 'chip chip--accent',
    style: { display: 'none', margin: '0 4px 8px' },
    text: '正在重新连接…',
  });

  const nav = h(
    'header',
    { class: 'nav' },
    h(
      'div',
      { class: 'nav__bar' },
      h('div', { class: 'nav__leading' }),
      h('div', { class: 'nav__compact', text: '消息' }),
      h(
        'div',
        { class: 'nav__trailing' },
        h(
          'button',
          {
            class: 'icon-btn',
            'aria-label': '添加好友',
            onclick: () => onAddFriend?.(),
          },
          icon('userplus', { size: 19 })
        )
      )
    ),
    h(
      'div',
      { class: 'nav__large' },
      h('h1', { class: 'title-xl grow', text: '消息' }),
      badge(unreadTotal())
    )
  );

  const scroll = h(
    'div',
    { class: 'scroll' },
    h('div', { class: 'scroll__inner' }, banner, filter, h('div', { style: { height: '10px' } }), list)
  );

  scroll.addEventListener('scroll', () => {
    nav.classList.toggle('is-scrolled', scroll.scrollTop > 16);
  });

  search.addEventListener('input', () => {
    clearBtn.style.display = search.value ? 'grid' : 'none';
    render();
  });

  function matches(conv) {
    const term = search.value.trim().toLowerCase();
    if (!term) return true;
    const peer = conv.peer || {};
    return (
      String(peer.displayName || '').toLowerCase().includes(term) ||
      String(peer.username || '').toLowerCase().includes(term) ||
      String(conv.lastMessage?.body || '').toLowerCase().includes(term)
    );
  }

  function render() {
    banner.style.display = state.wsState === 'open' ? 'none' : 'flex';
    banner.textContent = state.wsState === 'connecting' ? '正在连接…' : '网络断开，正在重连…';

    const items = state.conversations.filter(matches);
    clear(list);

    if (!state.conversations.length) {
      list.append(
        emptyState({
          emoji: '🐳',
          title: '这里还很安静',
          text: '加几个好友，或者跟大肥鱼打个招呼吧',
          action: h(
            'button',
            {
              class: 'btn btn--primary btn--sm',
              style: { marginTop: '6px' },
              onclick: () => onAddFriend?.(),
            },
            '添加好友'
          ),
        })
      );
      return;
    }

    if (!items.length) {
      list.append(
        emptyState({ emoji: '🔍', title: '没有找到聊天', text: '换一个关键词试试' })
      );
      return;
    }

    for (const conv of items) {
      const peer = conv.peer || {};
      const typing = state.typing.get(conv.id);
      const isTyping = typing && typing.until > Date.now();
      const online = peer.isBot || state.online.has(peer.id);
      const preview = isTyping
        ? h('span', { class: 'typing', 'aria-label': '正在输入' }, h('i'), h('i'), h('i'))
        : h('span', { class: 'ellipsis', text: previewOf(conv.lastMessage) });

      list.append(
        h(
          'button',
          {
            class: `conv press ${conv.unread ? 'conv--unread' : ''}`,
            onclick: () => onOpen?.(conv.id),
          },
          avatar(peer, { size: 'md', online, showStatus: true }),
          h(
            'div',
            { class: 'conv__body' },
            h(
              'div',
              { class: 'conv__top' },
              h('span', { class: 'conv__name ellipsis', text: peer.displayName || '未知' }),
              peer.isBot ? h('span', { class: 'chip chip--accent', text: 'AI' }) : null,
              h('span', { class: 'conv__time', text: timeAgo(conv.lastMessageAt) })
            ),
            h(
              'div',
              { class: 'conv__preview' },
              preview,
              h(
                'span',
                { class: 'conv__meta' },
                conv.unread ? badge(conv.unread) : null
              )
            )
          )
        )
      );
    }
  }

  render();

  return { el: h('div', { class: 'screen' }, nav, scroll), render, nav, scroll };
}
