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
  addInboxMemberToAccount,
  upload,
  getContactList,
  getContactSearch,
  postCreateContact,
  getContactDetail,
  putUpdateContact,
  deleteContactById,
  putBlockContact,
  putMergeContact,
  getContactInboxes,
  postCreateContactInbox,
  getContactConversationList,
  postCreateConversation,
  postStartConversation,
  getUserDetail,
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
router.post("/:accountId/inbox_members", addInboxMemberToAccount);
router.get("/:accountId", getChatwootAccountDetail);

// Contact routes
router.get("/:accountId/contacts", getContactList);
router.get("/:accountId/contacts/search", getContactSearch);
router.post("/:accountId/contacts", postCreateContact);
router.get("/:accountId/contacts/:contactId", getContactDetail);
router.put("/:accountId/contacts/:contactId", putUpdateContact);
router.delete("/:accountId/contacts/:contactId", deleteContactById);
router.put("/:accountId/contacts/:contactId/block", putBlockContact);
router.post("/:accountId/contacts/merge", putMergeContact);
router.get("/:accountId/contacts/:contactId/contactable_inboxes", getContactInboxes);
router.post("/:accountId/contacts/:contactId/contact_inboxes", postCreateContactInbox);
router.get("/:accountId/contacts/:contactId/conversations", getContactConversationList);
router.post("/:accountId/conversations", postCreateConversation);
router.post("/:accountId/conversations/start", postStartConversation);
router.get("/users/:userId", getUserDetail);

export default router;
