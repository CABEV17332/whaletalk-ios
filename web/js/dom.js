/** 极小的 DOM 构建工具，够用且不引框架 */

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props && typeof props === 'object') {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (key === 'html') el.innerHTML = value;
      else if (key === 'style' && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
          if (k.startsWith('--')) el.style.setProperty(k, v);
          else el.style[k] = v;
        }
      } else if (key === 'dataset') {
        Object.assign(el.dataset, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value === true) {
        el.setAttribute(key, '');
      } else {
        el.setAttribute(key, value);
      }
    }
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function on(target, event, handler, options) {
  target.addEventListener(event, handler, options);
  return () => target.removeEventListener(event, handler, options);
}

/** 桌面端鼠标跟随的高光（液态玻璃的“反光”会跟着指针走） */
export function attachPointerGlow(root) {
  if (window.matchMedia('(hover: none)').matches) return;
  let frame = 0;
  let last = null;
  root.addEventListener('pointermove', (event) => {
    last = event;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const target = last.target.closest?.('.glass, .conv, .bubble--out');
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--mx', `${((last.clientX - rect.left) / rect.width) * 100}%`);
      target.style.setProperty('--my', `${((last.clientY - rect.top) / rect.height) * 100}%`);
    });
  });
}

export function isEditable(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

export function scrollToBottom(el, smooth = false) {
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

export function nextTick() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
