#!/usr/bin/env node
/**
 * 写入 App 要连接的后端地址（打包 iOS 前必须执行一次）。
 *
 *   node scripts/ios-config.mjs --url https://chat.example.com
 *   node scripts/ios-config.mjs --url http://192.168.1.10:8787 --app-name 鲸语
 *
 * 说明：iOS 工程用 WKWebView 直接加载你的服务器地址，
 * 这样前端更新不用重新签 IPA；同时本地也留了一份 web/ 作为兜底。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'capacitor.config.json');

const argv = process.argv.slice(2);
function arg(name, fallback = undefined) {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : fallback;
}

let url = arg('url', process.env.WHALETALK_SERVER_URL || '');
if (!url) {
  console.error('用法: node scripts/ios-config.mjs --url https://chat.example.com');
  process.exit(1);
}
url = url.trim().replace(/\/+$/, '');
if (!/^https?:\/\//.test(url)) {
  console.error('地址要以 http:// 或 https:// 开头');
  process.exit(1);
}
const isLocal = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url);
if (!url.startsWith('https://') && !isLocal) {
  console.warn('⚠️  建议用 HTTPS：iOS 的 WKWebView 默认会拦掉非本地的 http 请求');
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
config.server = config.server || {};
config.server.url = url;
config.server.cleartext = url.startsWith('http://');
config.appName = arg('app-name', config.appName || '鲸语');
if (arg('bundle-id')) config.appId = arg('bundle-id');

fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
console.log(`✓ capacitor.config.json 已更新`);
console.log(`  地址     ${config.server.url}`);
console.log(`  App 名称 ${config.appName}`);
console.log(`  包名     ${config.appId}`);
console.log(`  明文传输 ${config.server.cleartext ? '是（仅本地开发建议）' : '否'}`);
