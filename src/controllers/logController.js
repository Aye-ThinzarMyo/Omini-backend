import { Log, User } from "../database/models";
import { Op } from "sequelize";

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

    const agentIds = logs
      .map((l) => l.agentId)
      .filter(Boolean)
      .map((v) => String(v))
      .filter((v) => /^\d+$/.test(v));
    const agentMap = {};
    if (agentIds.length) {
      const agents = await User.findAll({
        where: { chat_admin_user_id: { [Op.in]: agentIds } },
        attributes: ["chat_admin_user_id", "full_name"],
      });
      for (const a of agents) agentMap[String(a.chat_admin_user_id)] = a.full_name;
    }

    for (const log of logs) {
      if (log.targetType === "user" || log.targetType === "agent") {
        log.targetName = userMap[String(log.targetId)] || null;
      }
      if (log.agentId && /^\d+$/.test(String(log.agentId))) {
        log.assigneeName = agentMap[String(log.agentId)] || null;
      } else if (
        log.action === "assign_conversation" ||
        log.action === "unassigned_conversation"
      ) {
        log.assigneeName = "Unassigned";
      }
    }

    res.json({ logs, total: count, page: pageNum, pageSize: limit });
  } catch (err) {
    console.error("Get logs failed:", err);
    res.status(500).json({ error: "Failed to fetch logs", detail: err.message });
  }
};
