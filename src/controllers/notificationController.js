import { Notification } from "../database/models";
import {
  setupNotificationSse,
  connectNotifications,
} from "../services/notifications";

export const notificationStream = async (req, res) => {
  setupNotificationSse(res);
  try {
    connectNotifications(req.user.sub, res);
  } catch (err) {
    console.error("Notification stream error:", err);
    res.end();
  }
};

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.sub;
    // limit = how many to return (no pagination offset). Default 50.
    const limit = parseInt(req.query.limit) || 50;

    const { rows, count } = await Notification.findAndCountAll({
      where: { user_id: userId },
      order: [["created_at", "DESC"]],
      limit,
    });
    const unreadCount = await Notification.count({
      where: { user_id: userId, is_read: false },
    });

    res.json({ notifications: rows, total: count, unreadCount, limit });
  } catch (err) {
    console.error("Get notifications error:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { id } = req.params;

    const [updated] = await Notification.update(
      { is_read: true },
      { where: { id, user_id: userId } },
    );

    if (!updated) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({ message: "Marked as read" });
  } catch (err) {
    console.error("Mark as read error:", err);
    res.status(500).json({ error: "Failed to mark as read" });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.sub;

    await Notification.update(
      { is_read: true },
      { where: { user_id: userId, is_read: false } },
    );

    res.json({ message: "All marked as read" });
  } catch (err) {
    console.error("Mark all as read error:", err);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
};
