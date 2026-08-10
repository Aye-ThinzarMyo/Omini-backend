import { Log, User } from "../database/models";
import { getContact } from "./chatwoot";
import { decrypt } from "../utils/encryption";

export async function writeLog({
  userId,
  role,
  status,
  action,
  targetType,
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

export function logAfterResponse(res, fn) {
  res.on("finish", () => {
    Promise.resolve()
      .then(fn)
      .catch((err) => console.error("Failed to write audit log:", err.message));
  });
}

export function logAction({ action, targetType, description }) {
  return (req, res, next) => {
    const originalSend = res.send.bind(res);
    res.send = (body) => {
      const result = originalSend(body);
      res.on("finish", async () => {
        try {
          const status =
            res.statusCode >= 200 && res.statusCode < 400
              ? "success"
              : "failed";
          const act = typeof action === "function" ? action(req) : action;
          let desc;
          if (typeof description === "function") {
            desc = await description(req, res, body);
          } else {
            desc = description;
          }
          const actor = await actorFromRequest(req);
          await writeLog({
            ...actor,
            status,
            action: act,
            targetType,
            description: desc || null,
          });
        } catch (err) {
          console.error("Failed to write audit log:", err.message);
        }
      });
      return result;
    };
    next();
  };
}
