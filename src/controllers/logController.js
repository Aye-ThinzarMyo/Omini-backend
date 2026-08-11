import { Log, User } from "../database/models";
import { Op } from "sequelize";

export const getLogs = async (req, res) => {
  const {
    userId,
    action,
    targetType,
    status,
    q,
    date,
    startDate,
    endDate,
    page,
    pageSize,
  } = req.query;

  const where = {};
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  if (status) where.status = status;

  if (q) {
    const like = { [Op.iLike]: `%${q}%` };
    where[Op.or] = [
      { description: like },
      { action: like },
      { targetType: like },
      { "$user.full_name$": like },
      { "$user.email$": like },
    ];
  }

  if (date) {
    where.created_at = {
      [Op.gte]: new Date(`${date}T00:00:00`),
      [Op.lte]: new Date(`${date}T23:59:59`),
    };
  } else if (startDate || endDate) {
    where.created_at = {};
    if (startDate) where.created_at[Op.gte] = new Date(`${startDate}T00:00:00`);
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
      distinct: true,
    });

    const logs = rows.map((log) => log.toJSON());

    res.json({
      logs,
      total: count,
      page: pageNum,
      pageSize: limit,
      totalPages: Math.ceil(count / limit),
    });
  } catch (err) {
    console.error("Get logs failed:", err);
    res.status(500).json({ error: "Failed to fetch logs", detail: err.message });
  }
};
