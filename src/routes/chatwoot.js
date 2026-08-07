import { Router } from "express";
import { logAction } from "../services/auditLog";
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
  updateChatwootAccount,
  exportOutgoingMessages,
  exportIncomingMessages,
  exportConversations,
  exportChannelTraffic,
  exportContacts,
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
  logAction({
    action: (req) =>
      req.body?.assignee_id && req.body.assignee_id !== "none"
        ? "assign_conversation"
        : "unassigned_conversation",
    targetType: "conversation",
    targetId: (req) => req.params.conversationId,
    agentId: (req) =>
      req.body?.assignee_id && req.body.assignee_id !== "none"
        ? req.body.assignee_id
        : null,
  }),
  assignConversationToAgent,
);
router.post(
  "/:accountId/inbox_members",
  logAction({
    action: "add_inbox_member",
    targetType: "inbox",
    targetId: (req) => req.query.inbox_id || req.body?.inbox_id,
  }),
  addInboxMemberToAccount,
);
router.get("/:accountId", getChatwootAccountDetail);

// Export routes
router.get(
  "/:accountId/export/messages/outgoing",
  logAction({ action: "export", targetType: "outgoing_messages", targetId: (req) => req.params.accountId }),
  exportOutgoingMessages,
);
router.get(
  "/:accountId/export/messages/incoming",
  logAction({ action: "export", targetType: "incoming_messages", targetId: (req) => req.params.accountId }),
  exportIncomingMessages,
);
router.get(
  "/:accountId/export/conversations",
  logAction({ action: "export", targetType: "conversations", targetId: (req) => req.params.accountId }),
  exportConversations,
);
router.get(
  "/:accountId/export/channels",
  logAction({ action: "export", targetType: "channels", targetId: (req) => req.params.accountId }),
  exportChannelTraffic,
);
router.get(
  "/:accountId/export/contacts",
  logAction({ action: "export", targetType: "contacts", targetId: (req) => req.params.accountId }),
  exportContacts,
);

// Contact routes
router.get("/:accountId/contacts", getContactList);
router.get("/:accountId/contacts/search", getContactSearch);
router.post(
  "/:accountId/contacts",
  logAction({ action: "create", targetType: "contact", targetId: null }),
  postCreateContact,
);
router.get("/:accountId/contacts/:contactId", getContactDetail);
router.put(
  "/:accountId/contacts/:contactId",
  logAction({ action: "update", targetType: "contact", targetId: (req) => req.params.contactId }),
  putUpdateContact,
);
router.delete(
  "/:accountId/contacts/:contactId",
  logAction({ action: "delete", targetType: "contact", targetId: (req) => req.params.contactId }),
  deleteContactById,
);
router.put(
  "/:accountId/contacts/:contactId/block",
  logAction({ action: "block", targetType: "contact", targetId: (req) => req.params.contactId }),
  putBlockContact,
);
router.post(
  "/:accountId/contacts/merge",
  logAction({ action: "merge", targetType: "contact", targetId: (req) => req.body?.base_contact_id || req.body?.baseContactId }),
  putMergeContact,
);
router.get("/:accountId/contacts/:contactId/contactable_inboxes", getContactInboxes);
router.post(
  "/:accountId/contacts/:contactId/contact_inboxes",
  logAction({ action: "create", targetType: "contact_inbox", targetId: (req) => req.params.contactId }),
  postCreateContactInbox,
);
router.get("/:accountId/contacts/:contactId/conversations", getContactConversationList);
router.post(
  "/:accountId/conversations",
  logAction({ action: "create", targetType: "conversation", targetId: null }),
  postCreateConversation,
);
router.post(
  "/:accountId/conversations/start",
  logAction({ action: "create", targetType: "conversation", targetId: null }),
  postStartConversation,
);
router.get("/users/:userId", getUserDetail);
router.put(
  "/:accountId/account",
  logAction({ action: "update", targetType: "account", targetId: (req) => req.params.accountId }),
  updateChatwootAccount,
);

export default router;
