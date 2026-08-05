import { Router } from "express";
import {
  agentPresenceStream,
  presenceObserverStream,
  getPresenceStatus,
} from "../controllers/presenceController";

const router = Router();

router.get("/presence/me", agentPresenceStream);
router.get("/presence", presenceObserverStream);
router.get("/presence/status", getPresenceStatus);

export default router;
