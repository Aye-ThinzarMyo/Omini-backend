import { Log, User } from "../database/models";
import { Op } from "sequelize";
import { getContact } from "../services/chatwoot";
import { decrypt } from "../utils/encryption";

async function getChatwootToken(req) {
  const user = await User.findByPk(req.user.sub);
  return user?.encrypted_chat_secret
    ? decrypt(user.encrypted_chat_secret)
    : null;
}

export const getLogs = async (req, res) => {
  const { userId, action, targetType, status, startDate, endDate, page, pageSize } =
    req.query;

  const where = {};
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  if (status) where.status = status;
  if (startDate || endDate) {
    where.created_at = {};
    if (startDate) where.created_at[Op.gte] = new Date(startDate);
    if (endDate) where.created_at[Op.lte] = new Date(`${endDate}T23:59:59`);
  }

  const limit = Math.min(parseInt(pageSize) || 50, 500);
  const pageNum = parseInt(page) || 1;
  const offset = (pageNum - 1) * limit;

  try {
    const { rows, count } = await Log.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "full_name", "email", "role"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
    });

    const logs = rows.map((log) => log.toJSON());

    const userTargetIds = logs
      .filter((l) => l.targetType === "user" || l.targetType === "agent")
      .map((l) => l.targetId)
      .filter(Boolean);
    const userMap = {};
    if (userTargetIds.length) {
      const users = await User.findAll({
        where: { chat_admin_user_id: { [Op.in]: userTargetIds } },
        attributes: ["chat_admin_user_id", "full_name"],
      });
      for (const u of users) userMap[String(u.chat_admin_user_id)] = u.full_name;
    }

    const contactLogs = logs.filter(
      (l) => l.targetType === "contact" && l.accountId && l.targetId,
    );
    const contactMap = {};
    if (contactLogs.length) {
      const token = await getChatwootToken(req);
      if (token) {
        await Promise.all(
          contactLogs.map(async (l) => {
            try {
              const data = await getContact(l.accountId, l.targetId, token);
              contactMap[`${l.accountId}:${l.targetId}`] =
                data?.payload?.name ||
                data?.payload?.contact?.name ||
                data?.contact?.name ||
                data?.name ||
                null;
            } catch {
              contactMap[`${l.accountId}:${l.targetId}`] = null;
            }
          }),
        );
      }
    }

    for (const log of logs) {
      if (log.targetType === "user" || log.targetType === "agent") {
        log.targetName = userMap[String(log.targetId)] || null;
      } else if (log.targetType === "contact") {
        log.targetName = contactMap[`${log.accountId}:${log.targetId}`] || null;
      }
    }

    res.json({ logs, total: count, page: pageNum, pageSize: limit });
  } catch (err) {
    console.error("Get logs failed:", err);
    res.status(500).json({ error: "Failed to fetch logs", detail: err.message });
  }
};
