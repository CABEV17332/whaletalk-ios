/** WebSocket 客户端：自动重连、心跳、断线补拉 */

export function connectSocket({ token, onEvent, onState }) {
  let socket = null;
  let closedByUs = false;
  let attempts = 0;
  let reconnectTimer = null;
  let pingTimer = null;
  let lastPong = Date.now();
  let state = 'idle';

  function url() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws?token=${encodeURIComponent(token)}`;
  }

  function setState(next) {
    if (state === next) return;
    state = next;
    onState?.(next);
  }

  function schedule() {
    if (closedByUs) return;
    const delay = Math.min(24_000, 700 * 2 ** attempts) + Math.random() * 600;
    attempts += 1;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(open, delay);
  }

  function open() {
    if (closedByUs) return;
    if (socket && (socket.readyState === 0 || socket.readyState === 1)) return;
    setState('connecting');
    try {
      socket = new WebSocket(url());
    } catch {
      schedule();
      return;
    }

    socket.onopen = () => {
      attempts = 0;
      lastPong = Date.now();
      setState('open');
      clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (Date.now() - lastPong > 70_000) {
          try {
            socket.close();
          } catch {
            /* ignore */
          }
          return;
        }
        send({ t: 'ping' });
      }, 22_000);
    };

    socket.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.t === 'pong') {
        lastPong = Date.now();
        return;
      }
      if (msg.t === 'ready') {
        onEvent?.({ t: 'reconnected' });
      }
      onEvent?.(msg);
    };

    socket.onclose = () => {
      clearInterval(pingTimer);
      if (closedByUs) {
        setState('closed');
        return;
      }
      setState('offline');
      schedule();
    };

    socket.onerror = () => {
      try {
        socket.close();
      } catch {
        /* ignore */
      }
    };
  }

  function send(payload) {
    if (socket && socket.readyState === 1) {
      try {
        socket.send(JSON.stringify(payload));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  function close() {
    closedByUs = true;
    clearTimeout(reconnectTimer);
    clearInterval(pingTimer);
    controller.abort();
    try {
      socket?.close();
    } catch {
      /* ignore */
    }
    setState('closed');
  }

  // 回到前台立刻尝试重连
  const controller = new AbortController();
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState === 'visible' && !closedByUs) {
        if (!socket || socket.readyState > 1) open();
      }
    },
    { signal: controller.signal }
  );
  window.addEventListener(
    'online',
    () => {
      if (!closedByUs) open();
    },
    { signal: controller.signal }
  );

  open();
  return { close, send, get state() { return state; } };
}
