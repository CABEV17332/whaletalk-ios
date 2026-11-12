import { h, clear } from '../dom.js';
import { state, unreadTotal } from '../store.js';
import { api, compressImage } from '../api.js';
import { icon } from '../icons.js';
import { avatar, openSheet, toast, confirmSheet, segmented } from '../ui.js';
import { openEditProfile } from './sheets.js';
import { getGlass, setGlass, getWallpaper, setWallpaper, getDim, setDim } from '../prefs.js';

const NOTIFY_KEY = 'whaletalk.notify';

export function notificationsEnabled() {
  return localStorage.getItem(NOTIFY_KEY) === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

/** 我的：资料、外观、通知、服务器信息、退出 */
export function renderMe({ onLogout, theme, onThemeChange }) {
  const user = state.me;
  const body = h('div');

  const nav = h(
    'header',
    { class: 'nav' },
    h(
      'div',
      { class: 'nav__bar' },
      h('div', { class: 'nav__leading' }),
      h('div', { class: 'nav__compact', text: '我' }),
      h('div', { class: 'nav__trailing' })
    ),
    h('div', { class: 'nav__large' }, h('h1', { class: 'title-xl', text: '我' }))
  );

  const scroll = h('div', { class: 'scroll' }, h('div', { class: 'scroll__inner' }, body));
  scroll.addEventListener('scroll', () => nav.classList.toggle('is-scrolled', scroll.scrollTop > 16));

  function hero() {
    const idChip = h(
      'button',
      {
        class: 'profile-hero__id',
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(user.username);
            toast('用户名已复制', { type: 'success' });
          } catch {
            toast(`你的用户名：${user.username}`);
          }
        },
      },
      h('span', { text: `@${user.username}` }),
      icon('copy', { size: 13 })
    );

    return h(
      'div',
      { class: 'profile-hero' },
      h(
        'div',
        { style: { position: 'relative' } },
        avatar(user, { size: 'xl', online: true, showStatus: true })
      ),
      h('div', { class: 'profile-hero__name', text: user.displayName }),
      idChip,
      user.bio ? h('p', { class: 'text-sm muted', style: { maxWidth: '280px' }, text: user.bio }) : null,
      h(
        'div',
        { class: 'row', style: { gap: '8px', marginTop: '4px' } },
        h(
          'button',
          {
            class: 'pill-btn',
            onclick: () =>
              openEditProfile({
                user,
                onSaved: () => window.dispatchEvent(new CustomEvent('whaletalk:refresh-me')),
              }),
          },
          '编辑资料'
        ),
        h(
          'button',
          {
            class: 'pill-btn pill-btn--muted',
            onclick: () => window.dispatchEvent(new CustomEvent('whaletalk:open-add-friend')),
          },
          '添加好友'
        )
      )
    );
  }

  function stats() {
    return h(
      'div',
      { class: 'stats' },
      h('div', { class: 'stat' }, h('div', { class: 'stat__value', text: String(state.friends.length) }), h('div', { class: 'stat__label', text: '好友' })),
      h('div', { class: 'stat' }, h('div', { class: 'stat__value', text: String(state.conversations.length) }), h('div', { class: 'stat__label', text: '会话' })),
      h('div', { class: 'stat' }, h('div', { class: 'stat__value', text: String(unreadTotal()) }), h('div', { class: 'stat__label', text: '未读' }))
    );
  }

  function row({ iconName, label, value, hue = 210, onclick, trailing }) {
    return h(
      'button',
      { class: 'list__row', onclick },
      h('span', { class: 'list-row-hue', style: { '--h': String(hue) } }, icon(iconName, { size: 17 })),
      h('span', { class: 'grow text-sm', text: label }),
      value ? h('span', { class: 'text-sm faint', text: value }) : null,
      trailing || h('span', { class: 'list__chevron' }, icon('chevron-right', { size: 16 }))
    );
  }

  function render() {
    clear(body);
    body.append(hero(), stats());

    body.append(h('div', { class: 'section-label', text: '外观' }));
    const themeSeg = segmented({
      options: [
        { label: '浅色', value: 'light' },
        { label: '跟随系统', value: 'auto' },
        { label: '深色', value: 'dark' },
      ],
      value: theme,
      onChange: (value) => onThemeChange?.(value),
    });
    body.append(
      h(
        'div',
        { class: 'list glass', style: { padding: '10px 8px' } },
        h(
          'div',
          { class: 'row', style: { padding: '2px 6px 10px' } },
          h('span', { class: 'grow text-sm', text: '主题' }),
          h('span', { class: 'text-xs faint', text: '液态玻璃 · 深浅两套' })
        ),
        themeSeg
      )
    );

    body.append(h('div', { class: 'section-label', text: '玻璃质感' }));
    body.append(
      h(
        'div',
        { class: 'list glass', style: { padding: '10px 8px' } },
        segmented({
          options: [
            { label: '高透', value: 'high' },
            { label: '中等', value: 'mid' },
            { label: '不透明', value: 'solid' },
          ],
          value: getGlass(),
          onChange: (value) => setGlass(value),
        })
      )
    );

    body.append(h('div', { class: 'section-label', text: '聊天背景' }));
    const wallInput = h('input', { type: 'file', accept: 'image/*', class: 'sr-only' });
    const dimRange = h('input', {
      type: 'range',
      min: '0',
      max: '0.85',
      step: '0.05',
      value: String(getDim()),
      style: { width: '100%' },
      'aria-label': '背景明暗',
      oninput: (event) => setDim(Number(event.target.value)),
    });
    wallInput.addEventListener('change', async () => {
      const file = wallInput.files?.[0];
      if (!file) return;
      try {
        toast('处理中…', { duration: 1200 });
        const blob = await compressImage(file, 1400, 0.8);
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        setWallpaper(dataUrl);
        toast('背景已更新（仅本机可见）', { type: 'success' });
        render();
      } catch (err) {
        toast(err.message, { type: 'error' });
      } finally {
        wallInput.value = '';
      }
    });
    body.append(
      h(
        'div',
        { class: 'list glass', style: { padding: '2px 6px' } },
        row({ iconName: 'image', label: '背景图片', value: getWallpaper() ? '已设置' : '纯色', hue: 205, onclick: () => wallInput.click() }),
        getWallpaper()
          ? row({ iconName: 'xmark', label: '恢复纯色背景', hue: 8, onclick: () => { setWallpaper(''); toast('已恢复纯色'); render(); } })
          : null,
        h(
          'div',
          { class: 'list__row', style: { cursor: 'default' } },
          h('span', { class: 'list-row-hue', style: { '--h': '220' } }, icon('moon', { size: 17 })),
          h('span', { class: 'grow text-sm', text: '明暗' }),
          h('span', { style: { width: '52%' } }, dimRange)
        ),
        wallInput
      )
    );

    body.append(h('div', { class: 'section-label', text: '通知' }));
    const notifyOn = localStorage.getItem(NOTIFY_KEY) === '1';
    const switchEl = h('button', {
      class: 'switch',
      role: 'switch',
      'aria-checked': String(notifyOn && typeof Notification !== 'undefined' && Notification.permission === 'granted'),
      'aria-label': '桌面通知',
    });
    switchEl.addEventListener('click', async () => {
      if (typeof Notification === 'undefined') {
        toast('这个环境不支持通知，App 内会正常提醒');
        return;
      }
      if (Notification.permission === 'granted') {
        const next = switchEl.getAttribute('aria-checked') !== 'true';
        switchEl.setAttribute('aria-checked', String(next));
        localStorage.setItem(NOTIFY_KEY, next ? '1' : '0');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        localStorage.setItem(NOTIFY_KEY, '1');
        switchEl.setAttribute('aria-checked', 'true');
        toast('通知已开启', { type: 'success' });
      } else {
        toast('系统没有允许通知');
      }
    });

    body.append(
      h(
        'div',
        { class: 'list glass', style: { padding: '2px 6px' } },
        h(
          'div',
          { class: 'list__row' },
          h('span', { class: 'list-row-hue', style: { '--h': '28' } }, icon('bell', { size: 17 })),
          h('span', { class: 'grow text-sm', text: '桌面通知' }),
          switchEl
        )
      )
    );

    const soundSwitch = h('button', {
      class: 'switch',
      role: 'switch',
      'aria-checked': String(localStorage.getItem('whaletalk.sound') !== '0'),
      'aria-label': '消息提示音',
    });
    soundSwitch.addEventListener('click', () => {
      const next = soundSwitch.getAttribute('aria-checked') !== 'true';
      soundSwitch.setAttribute('aria-checked', String(next));
      localStorage.setItem('whaletalk.sound', next ? '1' : '0');
      if (next) {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = 1046;
          gain.gain.value = 0.05;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.12);
        } catch {
          /* 试听失败忽略 */
        }
      }
    });

    body.append(
      h(
        'div',
        { class: 'list glass', style: { padding: '2px 6px' } },
        h(
          'div',
          { class: 'list__row' },
          h('span', { class: 'list-row-hue', style: { '--h': '200' } }, icon('bell', { size: 17 })),
          h('span', { class: 'grow text-sm', text: '消息提示音' }),
          soundSwitch
        )
      )
    );

    body.append(h('div', { class: 'section-label', text: '关于' }));
    const wsLabel =
      state.wsState === 'open' ? '已连接' : state.wsState === 'connecting' ? '连接中' : '离线';
    body.append(
      h(
        'div',
        { class: 'list glass', style: { padding: '2px 6px' } },
        row({
          iconName: state.wsState === 'open' ? 'wifi' : 'wifi-off',
          hue: state.wsState === 'open' ? 142 : 8,
          label: '实时连接',
          value: wsLabel,
          trailing: h('span', { class: 'list__chevron' }, icon('chevron-right', { size: 16, stroke: 1.6 })),
          onclick: () =>
            openSheet({
              title: '服务器',
              content: h(
                'div',
                { class: 'stack' },
                h('div', { class: 'text-sm muted', text: '鲸语是自建的聊天服务，数据都在你自己的服务器上。' }),
                h(
                  'div',
                  { class: 'list glass' },
                  h('div', { class: 'list__row' }, h('span', { class: 'text-sm grow', text: '版本' }), h('span', { class: 'text-sm faint', text: state.config?.version || '1.0.0' })),
                  h('div', { class: 'list__row' }, h('span', { class: 'text-sm grow', text: '地址' }), h('span', { class: 'text-sm faint mono', text: location.host })),
                  h('div', { class: 'list__row' }, h('span', { class: 'text-sm grow', text: '实时通道' }), h('span', { class: 'text-sm faint', text: wsLabel }))
                )
              ),
            }),
        }),
        row({
          iconName: 'heart',
          hue: 330,
          label: '关于鲸语',
          onclick: () =>
            openSheet({
              title: '鲸语 WhaleTalk',
              content: h(
                'div',
                { class: 'stack', style: { gap: '12px' } },
                h('div', { class: 'brand-orb', style: { width: '64px', height: '64px', fontSize: '30px', borderRadius: '22px', margin: '0 auto' }, text: '🐳' }),
                h('p', { class: 'text-sm muted', style: { textAlign: 'center' }, text: '一个为「大肥鱼」做的液态玻璃聊天室。服务器常驻，手机随时收到消息。' }),
                h('div', { class: 'chip chip--accent', style: { margin: '0 auto' }, text: 'iOS 26 Liquid Glass · v1.0.0' })
              ),
            }),
        }),
        row({
          iconName: 'logout',
          hue: 8,
          label: '退出登录',
          onclick: async () => {
            const ok = await confirmSheet({
              title: '退出登录',
              message: '退出后需要重新输入密码才能回来。',
              confirmText: '退出',
              danger: true,
            });
            if (ok) onLogout?.();
          },
          trailing: null,
        })
      )
    );

    const brandSub = h('div', { class: 'about-brand__sub', text: '使用 deepseek 开发' });
    const brandLight = h('img', {
      class: 'about-brand__logo about-brand__logo--light',
      src: '/icons/huaxing.png',
      alt: '华兴交科',
    });
    const brandDark = h('img', {
      class: 'about-brand__logo about-brand__logo--dark',
      src: '/icons/huaxing-dark.png',
      alt: '华兴交科',
    });
    body.append(
      h(
        'div',
        { class: 'about-brand glass' },
        h('div', { class: 'about-brand__mark' }, brandLight, brandDark, brandSub)
      )
    );
    requestAnimationFrame(() => {
      const width = Math.ceil(brandSub.getBoundingClientRect().width);
      if (width > 0) {
        brandLight.style.width = `${width}px`;
        brandDark.style.width = `${width}px`;
      }
    });

    body.append(
      h('p', {
        class: 'text-xs faint',
        style: { textAlign: 'center', padding: '24px 10px 6px' },
        text: '鲸语 · 住在服务器里的小鲸鱼',
      })
    );
  }

  render();
  return { el: h('div', { class: 'screen' }, nav, scroll), render };
}
