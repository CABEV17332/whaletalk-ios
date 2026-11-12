/** 时间、文本与预览的格式化 */

const DAY = 86400_000;

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isSameDay(a, b) {
  return startOfDay(a) === startOfDay(b);
}

export function messageTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function timeAgo(ts) {
  if (!ts) return '';
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return '刚刚';
  if (isSameDay(ts, now)) return messageTime(ts);
  if (isSameDay(ts, now - DAY)) return '昨天';
  const d = new Date(ts);
  const days = Math.floor((startOfDay(now) - startOfDay(ts)) / DAY);
  if (days < 7) return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  if (d.getFullYear() === new Date().getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function dayLabel(ts) {
  const now = Date.now();
  const days = Math.round((startOfDay(now) - startOfDay(ts)) / DAY);
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days === 2) return '前天';
  if (days > 2 && days < 7) {
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(ts).getDay()];
  }
  const d = new Date(ts);
  if (d.getFullYear() === new Date().getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function relativeSeen(ts) {
  if (!ts) return '离线';
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚在线';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前在线`;
  if (isSameDay(ts, Date.now())) return `今天 ${messageTime(ts)} 在线`;
  if (isSameDay(ts, Date.now() - DAY)) return `昨天 ${messageTime(ts)} 在线`;
  return `最后在线 ${timeAgo(ts)}`;
}

export function initials(name = '') {
  const trimmed = String(name).trim();
  if (!trimmed) return '?';
  const chars = [...trimmed];
  return chars.slice(0, 2).join('').toUpperCase();
}

export function previewOf(message) {
  if (!message) return '';
  if (message.kind === 'image') return '🖼️ 图片';
  const text = String(message.body || '').replace(/\s+/g, ' ').trim();
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;

/** 把文本转成安全节点，同时把链接变成可点的 <a> */
export function linkify(text) {
  const fragment = document.createDocumentFragment();
  let last = 0;
  for (const match of String(text).matchAll(URL_RE)) {
    if (match.index > last) {
      fragment.append(document.createTextNode(text.slice(last, match.index)));
    }
    const a = document.createElement('a');
    a.className = 'bubble__link';
    a.href = match[0];
    a.target = '_blank';
    a.rel = 'noopener noreferrer nofollow';
    a.textContent = match[0];
    fragment.append(a);
    last = match.index + match[0].length;
  }
  if (last < text.length) fragment.append(document.createTextNode(text.slice(last)));
  return fragment;
}

export function plural(n, one, many = one) {
  return `${n} ${n === 1 ? one : many}`;
}

export function greetingByHour() {
  const hour = new Date().getHours();
  if (hour < 5) return '夜里的鲸鱼';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}
