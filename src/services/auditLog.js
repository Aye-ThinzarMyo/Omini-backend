import { Log, User } from "../database/models";
import { getContact } from "./chatwoot";
import { decrypt } from "../utils/encryption";

export async function writeLog({
  userId,
  role,
  status,
  action,
  targetType,
  targetId,
  agentId,
  description,
}) {
  if (!userId) return;
  try {
    await Log.create({
      userId,
      role: role || null,
      status: status || null,
      action,
      targetType: targetType || null,
      targetId: targetId != null ? String(targetId) : null,
      agentId: agentId != null ? String(agentId) : null,
      description: description || null,
    });
  } catch (err) {
    console.error("Failed to write audit log:", err.message);
  }
}

export async function actorFromRequest(req) {
  try {
    const user = await User.findByPk(req.user?.sub);
    return {
      userId: req.user?.sub || null,
      role: user?.role || req.user?.roles?.join(",") || null,
    };
  } catch {
    return { userId: req.user?.sub || null, role: null };
  }
}

export function contactFromBody(body) {
  if (!body) return null;
  try {
    const data = typeof body === "string" ? JSON.parse(body) : body;
    return data?.payload?.contact || data?.payload || data?.contact || null;
  } catch {
    return null;
  }
}

export function contactNameFromBody(body) {
  return contactFromBody(body)?.name || null;
}

export async function fetchContactData(accountId, contactId, req) {
  try {
    const user = await User.findByPk(req.user?.sub);
    if (!user?.encrypted_chat_secret) return null;
    const data = await getContact(
      accountId,
      contactId,
      decrypt(user.encrypted_chat_secret),
    );
    return contactFromBody(data);
  } catch {
    return null;
  }
}

export async function fetchContactName(accountId, contactId, req) {
  const contact = await fetchContactData(accountId, contactId, req);
  return contact?.name || null;
}

export function logAction({
  action,
  targetType,
  targetId,
  agentId,
  before,
  description,
}) {
  return async (req, res, next) => {
    if (before) {
      try {
        res.locals.logBefore = await before(req);
      } catch {
        res.locals.logBefore = undefined;
      }
    }
    const originalSend = res.send.bind(res);
    res.send = (body) => {
      const status =
        res.statusCode >= 200 && res.statusCode < 400 ? "success" : "failed";
      const act = typeof action === "function" ? action(req) : action;
      const tid = typeof targetId === "function" ? targetId(req) : targetId;
      const aid = typeof agentId === "function" ? agentId(req) : agentId;
      let desc;
      if (typeof description === "function") {
        try {
          desc = description(req, res, body);
        } catch {
          desc = undefined;
        }
      } else {
        desc = description;
      }
      actorFromRequest(req).then((actor) =>
        writeLog({
          ...actor,
          status,
          action: act,
          targetType,
          targetId: tid,
          agentId: aid || null,
          description: desc || null,
        }),
      );
      return originalSend(body);
    };
    next();
  };
}
