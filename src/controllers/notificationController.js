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
