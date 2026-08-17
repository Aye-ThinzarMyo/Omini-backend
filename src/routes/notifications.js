import { Router } from "express";
import { notificationStream } from "../controllers/notificationController";

const router = Router();

router.get("/notifications/stream", notificationStream);

export default router;
