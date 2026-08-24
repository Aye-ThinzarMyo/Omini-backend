const streams = new Map(); // userId -> Set<res>

function writeSse(res, event, data) {
  if (res.writableEnded || res.destroyed) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function setupNotificationSse(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");
}

export function connectNotifications(userId, res) {
  if (!streams.has(userId)) streams.set(userId, new Set());
  const conns = streams.get(userId);
  conns.add(res);

  const keepalive = setInterval(() => {
    if (!res.writableEnded && !res.destroyed) res.write(": keepalive\n\n");
  }, 25000);

  res.on("close", () => {
    clearInterval(keepalive);
    conns.delete(res);
    if (conns.size === 0) streams.delete(userId);
  });
}

// Push a live notification to a connected user's SSE streams.
// notification = { type, title, message, data }
// Returns true if at least one stream received it, false if the user is offline.
export function notify(userId, notification) {
  const conns = streams.get(userId);
  if (!conns || conns.size === 0) return false;

  const payload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: notification.type || "notification",
    title: notification.title || "",
    message: notification.message || "",
    data: notification.data || null,
    timestamp: new Date().toISOString(),
  };

  for (const res of conns) writeSse(res, "notification", payload);
  return true;
}

// Broadcast a notification to ALL connected users
export function notifyAll(notification) {
  const payload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: notification.type || "notification",
    title: notification.title || "",
    message: notification.message || "",
    data: notification.data || null,
    timestamp: new Date().toISOString(),
  };

  let count = 0;
  for (const [, conns] of streams) {
    for (const res of conns) writeSse(res, "notification", payload);
    count++;
  }
  return count > 0;
}

export function getConnectedUserIds() {
  return [...streams.keys()];
}
