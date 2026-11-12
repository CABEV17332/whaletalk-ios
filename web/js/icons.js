/** 线性图标（风格接近 SF Symbols），全部内联 SVG，无外部依赖 */

const PATHS = {
  message:
    '<path d="M20.8 11.6a8.3 8.3 0 0 1-8.3 8.3 8.9 8.9 0 0 1-3.6-.75L4.2 20.7l1.45-4.55a8 8 0 0 1-.9-3.55 8.3 8.3 0 0 1 8.3-8.3 8.3 8.3 0 0 1 8.3 8.3Z"/>',
  'message-fill':
    '<path d="M20.8 11.6a8.3 8.3 0 0 1-8.3 8.3 8.9 8.9 0 0 1-3.6-.75L4.2 20.7l1.45-4.55a8 8 0 0 1-.9-3.55 8.3 8.3 0 0 1 8.3-8.3 8.3 8.3 0 0 1 8.3 8.3Z" fill="currentColor" stroke="none"/>',
  people:
    '<circle cx="9.2" cy="8" r="3.5"/><path d="M2.8 20.4v-1.5a3.5 3.5 0 0 1 3.5-3.5h5.8a3.5 3.5 0 0 1 3.5 3.5v1.5"/><path d="M16.4 4.9a3.5 3.5 0 0 1 0 6.4"/><path d="M18 15.5a3.5 3.5 0 0 1 3.3 3.4v1.5"/>',
  'people-fill':
    '<circle cx="9.2" cy="8" r="3.6" fill="currentColor" stroke="none"/><path d="M2.8 20.4v-1.5a3.5 3.5 0 0 1 3.5-3.5h5.8a3.5 3.5 0 0 1 3.5 3.5v1.5" fill="currentColor" stroke="none"/><circle cx="17.4" cy="8.2" r="2.7" fill="currentColor" stroke="none" opacity=".55"/><path d="M16.6 15.6h2a3.2 3.2 0 0 1 3.2 3.2v1.6h-3.4" fill="currentColor" stroke="none" opacity=".55"/>',
  person:
    '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.4v-1.3a4.2 4.2 0 0 1 4.2-4.2h6a4.2 4.2 0 0 1 4.2 4.2v1.3"/>',
  'person-fill':
    '<circle cx="12" cy="8" r="3.7" fill="currentColor" stroke="none"/><path d="M4.6 20.4v-1.2a4.3 4.3 0 0 1 4.3-4.3h6.2a4.3 4.3 0 0 1 4.3 4.3v1.2Z" fill="currentColor" stroke="none"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16.6 16.6 4.1 4.1"/>',
  plus: '<path d="M12 5.2v13.6"/><path d="M5.2 12h13.6"/>',
  xmark: '<path d="m6.4 6.4 11.2 11.2"/><path d="M17.6 6.4 6.4 17.6"/>',
  'chevron-left': '<path d="M14.6 5 7.6 12l7 7"/>',
  'chevron-right': '<path d="M9.4 5 16.4 12l-7 7"/>',
  'arrow-up': '<path d="M12 19.2V5"/><path d="m5.8 11.2 6.2-6.2 6.2 6.2"/>',
  camera:
    '<path d="M4 8.6h3.1l1.4-2.2h7l1.4 2.2H20a1.6 1.6 0 0 1 1.6 1.6v7.6A1.6 1.6 0 0 1 20 19.4H4a1.6 1.6 0 0 1-1.6-1.6v-7.6A1.6 1.6 0 0 1 4 8.6Z"/><circle cx="12" cy="13.6" r="3.4"/>',
  bell: '<path d="M18 8.8a6 6 0 1 0-12 0c0 3.9-1.6 5.3-1.6 5.3h15.2S18 12.7 18 8.8Z"/><path d="M10.2 17.9a2 2 0 0 0 3.6 0"/>',
  moon: '<path d="M20.6 14.9A8.7 8.7 0 0 1 9.1 3.4 8.8 8.8 0 1 0 20.6 14.9Z"/>',
  sun: '<circle cx="12" cy="12" r="4.1"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6"/>',
  gear: '<circle cx="12" cy="12" r="3.4"/><path d="M19.2 14.3a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a1.9 1.9 0 1 1-3.8 0V20a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a1.9 1.9 0 1 1 0-3.8h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a1.9 1.9 0 1 1 3.8 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a1.9 1.9 0 1 1 0 3.8H21a1.6 1.6 0 0 0-1.5 1Z"/>',
  logout:
    '<path d="M14.8 4.2h3.4A1.6 1.6 0 0 1 19.8 5.8v12.4a1.6 1.6 0 0 1-1.6 1.6h-3.4"/><path d="m9.6 8.2-4 4 4 4"/><path d="M5.8 12.2h9.4"/>',
  copy: '<rect x="8.8" y="8.8" width="11" height="11" rx="2.4"/><path d="M5.2 14.8V6.2a2 2 0 0 1 2-2h8.6"/>',
  check: '<path d="m5 12.6 4.6 4.6L19.2 7.6"/>',
  'check-double': '<path d="m2.4 12.6 4 4 7.6-8"/><path d="m10.8 16.6 1.6 1.6 8.2-8.6"/>',
  more: '<circle cx="5.4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.6" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
  image:
    '<rect x="3" y="4.6" width="18" height="14.8" rx="3.2"/><circle cx="8.6" cy="10" r="1.7"/><path d="m4.4 17.6 4.6-4.4 3.4 3.2 2.8-2.6 4.4 4.2"/>',
  sticker:
    '<path d="M13.6 3.2H7.4A4.2 4.2 0 0 0 3.2 7.4v9.2a4.2 4.2 0 0 0 4.2 4.2h5.4a4.2 4.2 0 0 0 3-1.2l4.2-4.2a4.2 4.2 0 0 0 1.2-3V7.4a4.2 4.2 0 0 0-4.2-4.2Z"/><path d="M16.2 20.6v-3.4a2 2 0 0 1 2-2h2.4"/><circle cx="8.8" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.6" cy="10" r="1.1" fill="currentColor" stroke="none"/><path d="M8.6 14a4.4 4.4 0 0 0 6.2 0"/>',
  sparkles:
    '<path d="M12 3.2l1.7 4.5 4.5 1.7-4.5 1.7L12 15.6l-1.7-4.5L5.8 9.4l4.5-1.7L12 3.2Z"/><path d="M18.4 15.4l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3Z"/>',
  link: '<path d="M10.2 13.8a3.9 3.9 0 0 0 5.5 0l2.5-2.5a3.9 3.9 0 1 0-5.5-5.5l-1.3 1.3"/><path d="M13.8 10.2a3.9 3.9 0 0 0-5.5 0l-2.5 2.5a3.9 3.9 0 1 0 5.5 5.5l1.3-1.3"/>',
  send: '<path d="M12 19.4V5"/><path d="m5.8 11.2 6.2-6.2 6.2 6.2"/>',
  server:
    '<rect x="3.2" y="4.4" width="17.6" height="6" rx="2"/><rect x="3.2" y="13.6" width="17.6" height="6" rx="2"/><path d="M7 7.4h.01M7 16.6h.01"/>',
  shield:
    '<path d="M12 3.2 5 6v5.4c0 4.2 3 7.9 7 9.4 4-1.5 7-5.2 7-9.4V6l-7-2.8Z"/><path d="m9.2 12 2 2 3.6-4"/>',
  wifi: '<path d="M2.8 9.4a13 13 0 0 1 18.4 0"/><path d="M6 12.8a8.6 8.6 0 0 1 12 0"/><path d="M9.2 16.2a4.2 4.2 0 0 1 5.6 0"/><circle cx="12" cy="19.4" r="1.2" fill="currentColor" stroke="none"/>',
  'wifi-off':
    '<path d="M2.8 9.4a13 13 0 0 1 6.4-3.3"/><path d="M14.8 6.3a13 13 0 0 1 6.4 3.1"/><path d="M6 12.8a8.6 8.6 0 0 1 3.2-2"/><path d="M14.8 11a8.6 8.6 0 0 1 3.2 1.8"/><path d="M9.2 16.2a4.2 4.2 0 0 1 5.6 0"/><circle cx="12" cy="19.4" r="1.2" fill="currentColor" stroke="none"/><path d="m4 4 16 16"/>',
  heart: '<path d="M12 20.2S4 15.6 4 9.9a4.4 4.4 0 0 1 8-2.6 4.4 4.4 0 0 1 8 2.6c0 5.7-8 10.3-8 10.3Z"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.2 2"/>',
  userplus:
    '<circle cx="9.6" cy="8.2" r="3.6"/><path d="M2.8 20.2v-1.3a4.2 4.2 0 0 1 4.2-4.2h5.2a4.2 4.2 0 0 1 4.2 4.2v1.3"/><path d="M18.6 7.4v5.2M16 10h5.2"/>',
};

export function icon(name, { size = 22, stroke = 1.8, className = '' } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', stroke);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (className) svg.setAttribute('class', className);
  svg.innerHTML = PATHS[name] || PATHS.message;
  return svg;
}

export function whaleMark(size = 24) {
  const span = document.createElement('span');
  span.textContent = '🐳';
  span.style.fontSize = `${size}px`;
  span.style.lineHeight = '1';
  span.setAttribute('aria-hidden', 'true');
  return span;
}
