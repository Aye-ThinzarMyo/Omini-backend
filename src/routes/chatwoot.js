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
  markConversationRead,
  assignConversationToAgent,
  upload,
} from "../controllers/chatwootController";

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
router.post(
  "/:accountId/conversations/:conversationId/read",
  markConversationRead,
);
router.post(
  "/:accountId/conversations/:conversationId/assign",
  assignConversationToAgent,
);
router.get("/:accountId", getChatwootAccountDetail);

export default router;
