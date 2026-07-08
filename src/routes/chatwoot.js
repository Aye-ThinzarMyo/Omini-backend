import { Router } from "express";
import {
  getAccountInboxes,
  getChatwootAccountUsers,
  getConversationsList,
  getConversationDetail,
  getChatwootAgents,
  getChatwootAccountDetail,
  getChatwootReports,
  getChatwootDashboard,
  getChatwootMessages,
  sendChatwootMessage,
  upload,
} from "../controllers/chatwootController";
console.log("hi");
const router = Router();

router.get("/:accountId/inboxes", getAccountInboxes);
router.get("/:accountId/account-users", getChatwootAccountUsers);
router.get("/:accountId/conversations", getConversationsList);
router.get("/:accountId/conversations/:conversationId", getConversationDetail);
router.get("/:accountId/agents", getChatwootAgents);
router.get("/:accountId/reports", getChatwootReports);
router.get("/:accountId/dashboard", getChatwootDashboard);
router.get(
  "/:accountId/conversations/:conversationId/messages",
  getChatwootMessages,
);
router.post(
  "/:accountId/conversations/:conversationId/messages",
  upload.array("attachments"),
  sendChatwootMessage,
);
router.get("/:accountId", getChatwootAccountDetail);

export default router;
