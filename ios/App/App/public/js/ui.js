/** 通用交互组件：Toast、底部弹层、确认框、头像、空状态 */
import { h, clear, qs } from './dom.js';
import { icon } from './icons.js';
import { initials } from './format.js';

let toastHost = null;

export function toast(message, { type = 'info', duration = 2600 } = {}) {
  if (!toastHost) toastHost = qs('#toasts');
  const el = h(
    'div',
    { class: `toast toast--${type}`, role: 'status' },
    type === 'success' ? icon('check', { size: 16 }) : null,
    h('span', { text: message })
  );
  toastHost.append(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

export function haptic(pattern = 8) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

/* ─────────────── 底部弹层 ─────────────── */

export function openSheet({ title, content, onClose, className = '' }) {
  const layer = qs('#sheet-layer');
  const sheet = qs('#sheet');
  sheet.className = `sheet glass glass--strong ${className}`;
  clear(sheet);

  const body = h('div', { class: 'sheet__body' }, content);
  const close = () => {
    layer.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => {
      if (!layer.classList.contains('is-open')) {
        clear(sheet);
        sheet.className = 'sheet glass glass--strong';
      }
    }, 320);
    onClose?.();
  };

  const header = h(
    'div',
    { class: 'sheet__title' },
    h('span', { class: 'grow', text: title }),
    h(
      'button',
      {
        class: 'icon-btn icon-btn--plain',
        'aria-label': '关闭',
        onclick: close,
      },
      icon('xmark', { size: 18 })
    )
  );

  sheet.append(h('div', { class: 'sheet__grabber' }), header, body);
  document.body.style.overflow = 'hidden';
  layer.classList.add('is-open');
  qs('.sheet-backdrop').onclick = close;

  // 下拉关闭
  let startY = null;
  let delta = 0;
  sheet.addEventListener(
    'touchstart',
    (event) => {
      if (event.target.closest('.sheet__body') && body.scrollTop > 0) return;
      startY = event.touches[0].clientY;
      delta = 0;
      sheet.style.transition = 'none';
    },
    { passive: true }
  );
  sheet.addEventListener(
    'touchmove',
    (event) => {
      if (startY === null) return;
      delta = Math.max(0, event.touches[0].clientY - startY);
      sheet.style.transform = `translateY(${delta}px)`;
    },
    { passive: true }
  );
  sheet.addEventListener('touchend', () => {
    if (startY === null) return;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (delta > 110) close();
    startY = null;
  });

  const onKey = (event) => {
    if (event.key === 'Escape') {
      document.removeEventListener('keydown', onKey);
      close();
    }
  };
  document.addEventListener('keydown', onKey);

  setTimeout(() => body.querySelector('input, textarea, button')?.focus?.({ preventScroll: true }), 380);

  return { close, body, sheet };
}

export function confirmSheet({
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
      handle.close();
    };
    const handle = openSheet({
      title,
      onClose: () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      },
      content: h(
        'div',
        { class: 'stack' },
        h('p', { class: 'text-sm muted', text: message }),
        h(
          'div',
          { class: 'row', style: { gap: '10px', marginTop: '6px' } },
          h('button', { class: 'btn btn--glass grow', onclick: () => done(false) }, cancelText),
          h(
            'button',
            {
              class: `btn ${danger ? 'btn--danger' : 'btn--primary'} grow`,
              onclick: () => done(true),
            },
            confirmText
          )
        )
      ),
    });
  });
}

/* ─────────────── 头像 ─────────────── */

export function avatar(user, { size = 'md', online = false, showStatus = false } = {}) {
  const display = user?.displayName || user?.username || '?';
  const el = h('div', {
    class: `avatar avatar--${size}`,
    style: { '--h': String(user?.avatarHue ?? 210) },
    'aria-hidden': 'true',
  });
  el.append(h('div', { class: 'avatar__inner', text: user?.avatarEmoji || initials(display) }));
  if (showStatus && online) el.append(h('div', { class: 'avatar__dot' }));
  return el;
}

export function badge(count) {
  if (!count) return null;
  return h('span', { class: 'badge', text: count > 99 ? '99+' : String(count) });
}

/* ─────────────── 空状态 ─────────────── */

export function emptyState({ emoji = '🐳', title, text, action } = {}) {
  return h(
    'div',
    { class: 'empty' },
    h('div', { class: 'empty__orb', text: emoji }),
    title ? h('div', { class: 'empty__title', text: title }) : null,
    text ? h('div', { class: 'text-sm', text }) : null,
    action || null
  );
}

export function spinner(size = 18) {
  const el = h('span', { class: 'spinner' });
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  return el;
}

export function skeletonList(count = 4) {
  return h(
    'div',
    null,
    Array.from({ length: count }, () => h('div', { class: 'skeleton' }))
  );
}

/* ─────────────── 分段控件 ─────────────── */

export function segmented({ options, value, onChange }) {
  let current = options.findIndex((option) => option.value === value);
  if (current < 0) current = 0;

  const root = h('div', { class: 'segmented', role: 'tablist' });
  const thumb = h('div', { class: 'segmented__thumb' });
  const buttons = options.map((option, index) =>
    h(
      'button',
      {
        type: 'button',
        role: 'tab',
        'aria-selected': String(index === current),
        onclick: () => select(index),
      },
      option.label
    )
  );
  root.append(thumb, ...buttons);

  function place() {
    const button = buttons[current];
    if (!button || !button.offsetWidth) return;
    thumb.style.width = `${button.offsetWidth}px`;
    thumb.style.transform = `translateX(${button.offsetLeft - 3}px)`;
  }

  function select(index) {
    if (index === current) return;
    current = index;
    buttons.forEach((button, i) => button.setAttribute('aria-selected', String(i === index)));
    place();
    onChange?.(options[index].value);
  }

  requestAnimationFrame(place);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(place).observe(root);
  }
  return root;
}

