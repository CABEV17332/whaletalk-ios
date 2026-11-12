/** 外观偏好：玻璃档位、背景图、明暗，全部只存在本机。 */

const GLASS_KEY = 'whaletalk.glass';
const WALL_KEY = 'whaletalk.wallpaper';
const DIM_KEY = 'whaletalk.wallpaperDim';

export function getGlass() {
  const value = localStorage.getItem(GLASS_KEY);
  return ['high', 'mid', 'solid'].includes(value) ? value : 'mid';
}

export function applyGlass(value = getGlass()) {
  document.documentElement.dataset.glass = value;
}

export function setGlass(value) {
  const safe = ['high', 'mid', 'solid'].includes(value) ? value : 'mid';
  localStorage.setItem(GLASS_KEY, safe);
  applyGlass(safe);
}

export function getWallpaper() {
  return localStorage.getItem(WALL_KEY) || '';
}

export function getDim() {
  const value = Number(localStorage.getItem(DIM_KEY));
  return Number.isFinite(value) && value >= 0 && value <= 0.85 ? value : 0.28;
}

export function applyWallpaper() {
  const url = getWallpaper();
  let layer = document.querySelector('.wallpaper-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'wallpaper-layer';
    document.body.prepend(layer);
  }
  if (url) {
    layer.style.backgroundImage = `url("${url}")`;
    layer.style.setProperty('--dim', String(getDim()));
    document.body.classList.add('has-wallpaper');
  } else {
    layer.style.backgroundImage = '';
    document.body.classList.remove('has-wallpaper');
  }
}

export function setWallpaper(dataUrl) {
  if (dataUrl) localStorage.setItem(WALL_KEY, dataUrl);
  else localStorage.removeItem(WALL_KEY);
  applyWallpaper();
}

export function setDim(value) {
  const safe = Math.max(0, Math.min(0.85, Number(value) || 0));
  localStorage.setItem(DIM_KEY, String(safe));
  applyWallpaper();
}

export function applyAppearance() {
  applyGlass();
  applyWallpaper();
}
