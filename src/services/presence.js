import { User } from "../database/models";

const GRACE_MS = 3 * 1000;

const streams = new Map(); // userId -> Map<clientId, res>
const timers = new Map(); // userId -> offline grace timer
const lastSeen = new Map(); // userId -> last keepalive timestamp
const observers = new Set(); // observer SSE responses
const onlineUsers = new Set(); // userIds currently online

function writeSse(res, event, data) {
  if (res.writableEnded || res.destroyed) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function sanitizeUser(user) {
  if (!user) return null;
  const data = user.toJSON ? user.toJSON() : { ...user };
  delete data.encrypted_chat_secret;
  delete data.password;
  delete data.encrypted_freepbx_secret;
  return data;
}

function broadcast(event, data) {
  for (const res of observers) {
    writeSse(res, event, data);
  }
}

export function setupSse(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n");
}

export function agentConnect(userId, res) {
  if (!streams.has(userId)) streams.set(userId, new Map());
  const clients = streams.get(userId);
  const clientId = Math.random().toString(36).slice(2);
  clients.set(clientId, res);

  if (timers.has(userId)) {
    clearTimeout(timers.get(userId));
    timers.delete(userId);
  }

  const wasOffline = !onlineUsers.has(userId);
  onlineUsers.add(userId);
  lastSeen.set(userId, Date.now());

  // Keepalive refreshes lastSeen while the stream is open, so the
  // safety-net sweep below never flags an active connection as stale.
  const keepalive = setInterval(() => {
    lastSeen.set(userId, Date.now());
    res.write(": keepalive\n\n");
  }, 10000);

  // Attach the close handler synchronously, BEFORE any await, so a
  // disconnect during a slow DB query cannot be missed.
  res.on("close", () => {
    clearInterval(keepalive);
    clients.delete(clientId);
    if (clients.size === 0 && onlineUsers.has(userId)) {
      const timer = setTimeout(() => {
        if (!streams.has(userId) || streams.get(userId).size === 0) {
          onlineUsers.delete(userId);
          streams.delete(userId);
          timers.delete(userId);
          lastSeen.delete(userId);
          broadcast("presence.offline", { agentId: userId });
        }
      }, GRACE_MS);
      timers.set(userId, timer);
    }
  });

  if (wasOffline) {
    User.findByPk(userId)
      .then((user) => {
        broadcast("presence.online", {
          agent: sanitizeUser(user) || { id: userId },
        });
      })
      .catch(() => {});
  }
}

// Safety net: if the 'close' event is never fired (browser killed,
// mobile app backgrounded, network cut without FIN), sweep marks the
// agent offline once its keepalive goes stale past the grace period.
setInterval(() => {
  const now = Date.now();
  for (const [userId, last] of lastSeen) {
    const hasLiveStream = streams.has(userId) && streams.get(userId).size > 0;
    if (now - last > GRACE_MS && !hasLiveStream && onlineUsers.has(userId)) {
      onlineUsers.delete(userId);
      streams.delete(userId);
      timers.delete(userId);
      lastSeen.delete(userId);
      broadcast("presence.offline", { agentId: userId });
    }
  }
}, GRACE_MS).unref();

export async function observerConnect(res) {
  observers.add(res);

  const userIds = [...onlineUsers];
  const agents = [];
  if (userIds.length) {
    const users = await User.findAll({ where: { id: userIds } }).catch(
      () => [],
    );
    const byId = new Map(users.map((u) => [u.id, u]));
    for (const uid of userIds) {
      const u = byId.get(uid);
      if (u) agents.push(sanitizeUser(u));
    }
  }
  writeSse(res, "presence.snapshot", { online: agents });

  const keepalive = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 25000);

  res.on("close", () => {
    clearInterval(keepalive);
    observers.delete(res);
  });
}

export function getOnlineAgentIds() {
  return [...onlineUsers];
}

export async function getOnlineAgents() {
  const userIds = [...onlineUsers];
  if (!userIds.length) return [];
  const users = await User.findAll({ where: { id: userIds } }).catch(() => []);
  const byId = new Map(users.map((u) => [u.id, u]));
  const agents = [];
  for (const uid of userIds) {
    const u = byId.get(uid);
    if (u) agents.push(sanitizeUser(u));
  }
  return agents;
}
