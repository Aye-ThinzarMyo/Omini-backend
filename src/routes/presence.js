import { Router } from "express";
import {
  agentPresenceStream,
  presenceObserverStream,
} from "../controllers/presenceController";

const router = Router();

router.get("/presence/me", agentPresenceStream);
router.get("/presence", presenceObserverStream);

export default router;
