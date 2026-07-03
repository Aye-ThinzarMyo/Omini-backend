import { Router } from "express";
import { getAccountInboxes } from "../controllers/chatwootController";

const router = Router();

router.get("/:accountId/inboxes", getAccountInboxes);

export default router;
