import { Router } from "express";
import {
  logAction,
  contactNameFromBody,
  fetchContactName,
  assigneeNameFromId,
} from "../services/auditLog";
import {
  getAccountInboxes,
  getChatwootProfile,
  updateChatwootProfile,
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
  getChatwootAttachments,
  getChatwootParticipants,
  updateParticipants,
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
router.get(
  "/:accountId/conversations/:conversationId/attachments",
  getChatwootAttachments,
);
router.get(
  "/:accountId/conversations/:conversationId/participants",
  getChatwootParticipants,
);
router.patch(
  "/:accountId/conversations/:conversationId/participants",
  updateParticipants,
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
    description: async (req, res, body) => {
      const assigneeId = req.body?.assignee_id;
      if (assigneeId && assigneeId !== "none") {
        const name = await assigneeNameFromId(assigneeId);
        return name ? `assigned to ${name}` : `assigned to agent ${assigneeId}`;
      }
      return "unassigned";
    },
  }),
  assignConversationToAgent,
);
router.post(
  "/:accountId/inbox_members",
  logAction({
    action: "add_inbox_member",
    targetType: "inbox",
  }),
  addInboxMemberToAccount,
);
router.get("/profile", getChatwootProfile);
router.put("/profile", updateChatwootProfile);
router.get("/:accountId", getChatwootAccountDetail);

// Export routes
router.get(
  "/:accountId/export/messages/outgoing",
  logAction({
    action: "export",
    targetType: "outgoing_messages",
  }),
  exportOutgoingMessages,
);
router.get(
  "/:accountId/export/messages/incoming",
  logAction({
    action: "export",
    targetType: "incoming_messages",
  }),
  exportIncomingMessages,
);
router.get(
  "/:accountId/export/conversations",
  logAction({
    action: "export",
    targetType: "conversations",
  }),
  exportConversations,
);
router.get(
  "/:accountId/export/channels",
  logAction({
    action: "export",
    targetType: "channels",
  }),
  exportChannelTraffic,
);
router.get(
  "/:accountId/export/contacts",
  logAction({
    action: "export",
    targetType: "contacts",
  }),
  exportContacts,
);

// Contact routes
router.get("/:accountId/contacts", getContactList);
router.get("/:accountId/contacts/search", getContactSearch);
router.post(
  "/:accountId/contacts",
  logAction({
    action: "create",
    targetType: "contact",
    description: (req, res, body) => {
      const name = contactNameFromBody(body);
      return name ? `${name}` : undefined;
    },
  }),
  postCreateContact,
);
router.get("/:accountId/contacts/:contactId", getContactDetail);
router.put(
  "/:accountId/contacts/:contactId",
  logAction({
    action: "update",
    targetType: "contact",
    description: (req, res, body) => res.locals.contactUpdateDescription,
  }),
  putUpdateContact,
);
router.delete(
  "/:accountId/contacts/:contactId",
  logAction({
    action: "delete",
    targetType: "contact",
  }),
  deleteContactById,
);
router.put(
  "/:accountId/contacts/:contactId/block",
  logAction({
    action: (req) => (req.body?.blocked === false ? "unblock" : "block"),
    targetType: "contact",
    description: async (req, res, body) => {
      const name =
        contactNameFromBody(body) ||
        (await fetchContactName(
          req.params.accountId,
          req.params.contactId,
          req,
        ));
      const isUnblock = req.body?.blocked === false;
      return name
        ? `${isUnblock ? "Unblocked" : "Blocked"} contact: ${name}`
        : undefined;
    },
  }),
  putBlockContact,
);
router.post(
  "/:accountId/contacts/merge",
  logAction({
    action: "merge",
    targetType: "contact",
  }),
  putMergeContact,
);
router.get(
  "/:accountId/contacts/:contactId/contactable_inboxes",
  getContactInboxes,
);
router.post(
  "/:accountId/contacts/:contactId/contact_inboxes",
  logAction({
    action: "create",
    targetType: "contact_inbox",
  }),
  postCreateContactInbox,
);
router.get(
  "/:accountId/contacts/:contactId/conversations",
  getContactConversationList,
);
router.post(
  "/:accountId/conversations",
  logAction({ action: "create", targetType: "conversation" }),
  postCreateConversation,
);
router.post(
  "/:accountId/conversations/start",
  logAction({ action: "create", targetType: "conversation" }),
  postStartConversation,
);
router.get("/users/:userId", getUserDetail);
router.put(
  "/:accountId/account",
  logAction({
    action: "update",
    targetType: "account",
  }),
  updateChatwootAccount,
);

export default router;
