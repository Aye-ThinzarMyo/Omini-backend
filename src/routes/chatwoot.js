import { Router } from "express";
import { getAccountInboxes, getChatwootAccountUsers } from "../controllers/chatwootController";

const router = Router();

router.get("/:accountId/inboxes", getAccountInboxes);
router.get("/:accountId/account-users", getChatwootAccountUsers);

export default router;
