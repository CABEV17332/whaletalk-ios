/**
 * 用 Edge/Chrome 的无头模式截图 + 抓控制台错误。
 * 只用于本地验收 UI，不参与产品运行时。
 *
 * 用法：
 *   node scripts/shot.mjs --url http://127.0.0.1:8787/ --out shots/login.png
 *   node scripts/shot.mjs --url ... --out ... --eval "localStorage.setItem(...)" --wait 1500
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i += 1) {
  if (!argv[i].startsWith('--')) continue;
  const key = argv[i].slice(2);
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) {
    args[key] = true;
  } else {
    args[key] = next;
    i += 1;
  }
}

const URL_ = args.url || 'http://127.0.0.1:8787/';
const OUT = args.out || 'shot.png';
const WIDTH = Number(args.w || 430);
const HEIGHT = Number(args.h || 932);
const SCALE = Number(args.scale || 2);
const WAIT = Number(args.wait || 1400);
const EVAL = args['eval-file']
  ? fs.readFileSync(String(args['eval-file']), 'utf8')
  : args.eval || '';
const FULL = args.full === 'true' || args.full === true;

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const BROWSER = EDGE_CANDIDATES.find((p) => fs.existsSync(p));
if (!BROWSER) {
  console.error('找不到 Edge/Chrome');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

/* ── 极简 WebSocket 客户端（CDP 用） ── */
function wsConnect(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const key = crypto.randomBytes(16).toString('base64');
    const socket = net.connect(Number(u.port), u.hostname);
    let buffer = Buffer.alloc(0);
    let upgraded = false;
    const handlers = new Set();

    socket.once('connect', () => {
      socket.write(
        `GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
      );
    });

    function sendFrame(payload) {
      const data = Buffer.from(payload);
      const mask = crypto.randomBytes(4);
      const masked = Buffer.from(data);
      for (let i = 0; i < masked.length; i += 1) masked[i] ^= mask[i & 3];
      let header;
      if (data.length < 126) {
        header = Buffer.from([0x81, 0x80 | data.length]);
      } else if (data.length < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(data.length, 2);
      } else {
        header = Buffer.alloc(10);
        header[0] = 0x81;
        header[1] = 0x80 | 127;
        header.writeBigUInt64BE(BigInt(data.length), 2);
      }
      socket.write(Buffer.concat([header, mask, masked]));
    }

    function parse() {
      while (buffer.length >= 2) {
        const opcode = buffer[0] & 0x0f;
        let len = buffer[1] & 0x7f;
        let off = 2;
        if (len === 126) {
          if (buffer.length < 4) return;
          len = buffer.readUInt16BE(2);
          off = 4;
        } else if (len === 127) {
          if (buffer.length < 10) return;
          len = Number(buffer.readBigUInt64BE(2));
          off = 10;
        }
        if (buffer.length < off + len) return;
        const payload = buffer.subarray(off, off + len);
        buffer = buffer.subarray(off + len);
        if (opcode === 0x1) {
          const text = payload.toString('utf8');
          for (const fn of handlers) fn(text);
        }
      }
    }

    socket.on('data', (chunk) => {
      if (!upgraded) {
        buffer = Buffer.concat([buffer, chunk]);
        const idx = buffer.indexOf('\r\n\r\n');
        if (idx < 0) return;
        const head = buffer.subarray(0, idx).toString('utf8');
        buffer = buffer.subarray(idx + 4);
        upgraded = true;
        if (!head.startsWith('HTTP/1.1 101')) {
          reject(new Error(head.split('\r\n')[0]));
          return;
        }
        resolve({
          send: (obj) => sendFrame(JSON.stringify(obj)),
          onMessage: (fn) => handlers.add(fn),
          close: () => socket.destroy(),
        });
        parse();
        return;
      }
      buffer = Buffer.concat([buffer, chunk]);
      parse();
    });
    socket.on('error', reject);
  });
}

/* ── CDP 会话 ── */
async function main() {
  const port = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'whaletalk-cdp-'));
  const child = spawn(
    BROWSER,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--mute-audio',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let targets = null;
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const page = list.find((item) => item.type === 'page');
      if (page) {
        targets = page;
        break;
      }
    } catch {
      /* 等待浏览器起来 */
    }
    await sleep(150);
  }
  if (!targets) {
    child.kill();
    throw new Error('浏览器没有启动');
  }

  const ws = await wsConnect(targets.webSocketDebuggerUrl);
  let seq = 0;
  const pending = new Map();
  const logs = [];

  ws.onMessage((text) => {
    const msg = JSON.parse(text);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      logs.push(
        `[console.${msg.params.type}] ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`
      );
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      logs.push(`[exception] ${msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text}`);
    }
    if (msg.method === 'Log.entryAdded') {
      logs.push(`[log.${msg.params.entry.level}] ${msg.params.entry.text}`);
    }
  });

  function call(method, params = {}) {
    seq += 1;
    const id = seq;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send({ id, method, params });
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 20_000);
    });
  }

  await call('Runtime.enable');
  await call('Log.enable');
  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: SCALE,
    mobile: WIDTH < 600,
    screenWidth: WIDTH,
    screenHeight: HEIGHT,
  });
  await call('Emulation.setTouchEmulationEnabled', { enabled: WIDTH < 600, maxTouchPoints: 5 });
  await call('Page.navigate', { url: URL_ });
  await sleep(WAIT);

  async function evaluate(expression) {
    if (!expression) return;
    const result = await call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) logs.push(`[eval] ${JSON.stringify(result.exceptionDetails)}`);
    else if (result.result?.value !== undefined) logs.push(`[eval] ${JSON.stringify(result.result.value)}`);
  }

  // 第一步（通常用来登录 / 设置主题，会触发 reload）
  if (args['eval-before']) {
    await evaluate(fs.readFileSync(String(args['eval-before']), 'utf8'));
    await sleep(WAIT);
  }

  // 第二步：在已经登录的页面里继续操作（比如打开某个会话）
  await evaluate(EVAL);
  if (EVAL) await sleep(WAIT);

  const shot = await call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: FULL,
    fromSurface: true,
  });
  fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
  console.log(`screenshot → ${path.resolve(OUT)} (${WIDTH}x${HEIGHT}@${SCALE})`);
  if (logs.length) {
    console.log('--- 浏览器日志 ---');
    for (const line of logs.slice(0, 60)) console.log(line);
  } else {
    console.log('--- 浏览器日志为空（没有报错）---');
  }

  ws.close();
  child.kill();
  await sleep(200);
  fs.rmSync(profile, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
