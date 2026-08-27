import { Router } from "express";
import {
  notificationStream,
  getNotifications,
  markAsRead,
  markAllAsRead,
} from "../controllers/notificationController";

const router = Router();

router.get("/notifications/stream", notificationStream);
router.get("/notifications", getNotifications);
router.patch("/notifications/:id/read", markAsRead);
router.patch("/notifications/read-all", markAllAsRead);

export default router;
