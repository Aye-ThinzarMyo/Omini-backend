import { Log, User } from "../database/models";

export async function writeLog({
  userId,
  role,
  status,
  action,
  targetType,
  targetId,
  accountId,
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
      accountId: accountId != null ? String(accountId) : null,
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

export function logAction({ action, targetType, targetId }) {
  return async (req, res, next) => {
    const originalSend = res.send.bind(res);
    res.send = (body) => {
      const status =
        res.statusCode >= 200 && res.statusCode < 400 ? "success" : "failed";
      const tid = typeof targetId === "function" ? targetId(req) : targetId;
      actorFromRequest(req).then((actor) =>
        writeLog({
          ...actor,
          status,
          action,
          targetType,
          targetId: tid,
          accountId: req.params?.accountId || null,
        }),
      );
      return originalSend(body);
    };
    next();
  };
}
