import { User } from "../database/models";
import {
  getInboxes, getAccountUsers, getConversations, getConversation,
  getAgents, getAccount, getReport, getDashboardData, getMessages,
  sendMessage, assignConversation, updateLastSeen, addInboxMember,
  listContacts, searchContacts, createContact, getContact,
  updateContact, deleteContact, mergeContacts,
  getContactableInboxes, createContactInbox, getContactConversations,
} from "../services/chatwoot";
import { decrypt } from "../utils/encryption";
import multer from "multer";
import FormData from "form-data";

const upload = multer({ storage: multer.memoryStorage() });

export { upload };

export const getAccountInboxes = async (req, res) => {
  const { accountId } = req.params;

  if (!accountId) {
    return res.status(400).json({ error: "accountId is required" });
  }

  try {
    const user = await User.findByPk(req.user.sub);
    if (!user || !user.encrypted_chat_secret) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }

    const chatwootToken = decrypt(user.encrypted_chat_secret);
    const data = await getInboxes(accountId, chatwootToken);

    res.json({ inboxes: data });
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch inboxes from Chatwoot",
      detail: err.response?.data || err.message,
    });
  }
};

export const getChatwootAccountUsers = async (req, res) => {
  const { accountId } = req.params;

  if (!accountId) {
    return res.status(400).json({ error: "accountId is required" });
  }

  try {
    const data = await getAccountUsers(accountId);
    res.json({ account_users: data });
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch account users from Chatwoot",
      detail: err.response?.data || err.message,
    });
  }
};

async function getDecryptedChatToken(req) {
  const user = await User.findByPk(req.user.sub);
  if (!user || !user.encrypted_chat_secret) return null;
  return decrypt(user.encrypted_chat_secret);
}

export const getConversationsList = async (req, res) => {
  const { accountId } = req.params;

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }

    const data = await getConversations(accountId, chatwootToken, req.query);
    res.json({ conversations: data });
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch conversations from Chatwoot",
      detail: err.response?.data || err.message,
    });
  }
};

export const getConversationDetail = async (req, res) => {
  const { accountId, conversationId } = req.params;

  if (!accountId || !conversationId) {
    return res.status(400).json({ error: "accountId and conversationId are required" });
  }

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }

    const data = await getConversation(accountId, conversationId, chatwootToken);
    res.json({ conversation: data });
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch conversation from Chatwoot",
      detail: err.response?.data || err.message,
    });
  }
};

export const getChatwootAgents = async (req, res) => {
  const { accountId } = req.params;

  if (!accountId) {
    return res.status(400).json({ error: "accountId is required" });
  }

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }

    const data = await getAgents(accountId, chatwootToken);
    res.json({ agents: data });
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch agents from Chatwoot",
      detail: err.response?.data || err.message,
    });
  }
};

export const getChatwootAccountDetail = async (req, res) => {
  const { accountId } = req.params;

  if (!accountId) {
    return res.status(400).json({ error: "accountId is required" });
  }

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }

    const data = await getAccount(accountId, chatwootToken);
    res.json({ account: data });
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch account from Chatwoot",
      detail: err.response?.data || err.message,
    });
  }
};

export const getChatwootReports = async (req, res) => {
  const { accountId } = req.params;
  const { metric, type, since, until, id } = req.query;

  if (!metric || !type || !since || !until) {
    return res.status(400).json({ error: "metric, type, since, and until are required" });
  }

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }

    const data = await getReport(accountId, chatwootToken, { metric, type, since, until, id });
    res.json({ report: data });
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch report from Chatwoot",
      detail: err.response?.data || err.message,
    });
  }
};

export const getChatwootMessages = async (req, res) => {
  const { accountId, conversationId } = req.params;

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }

    const data = await getMessages(accountId, conversationId, chatwootToken);
    res.json({ messages: data });
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch messages from Chatwoot",
      detail: err.response?.data || err.message,
    });
  }
};

export const sendChatwootMessage = async (req, res) => {
  const { accountId, conversationId } = req.params;
  const { content, private: isPrivate, content_type } = req.body;

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }

    let messageData;

    if (req.files && req.files.length > 0) {
      const fd = new FormData();
      if (content) fd.append("content", content);
      if (isPrivate !== undefined) fd.append("private", isPrivate);
      if (content_type) fd.append("content_type", content_type);
      for (const file of req.files) {
        fd.append("attachments[]", file.buffer, { filename: file.originalname, contentType: file.mimetype });
      }
      messageData = await sendMessage(accountId, conversationId, chatwootToken, fd, true);
    } else {
      if (!content) {
        return res.status(400).json({ error: "content is required when no file is attached" });
      }

      const payload = { content };
      if (isPrivate !== undefined) payload.private = isPrivate;
      if (content_type) payload.content_type = content_type;

      messageData = await sendMessage(accountId, conversationId, chatwootToken, payload);
    }

    // Auto-assign conversation to the replying agent if unassigned
    try {
      const conv = await getConversation(accountId, conversationId, chatwootToken);
      const convData = conv?.data || conv?.payload || conv || {};
      if (!convData.assignee_id) {
        const user = await User.findByPk(req.user.sub);
        if (user?.chat_admin_user_id) {
          await assignConversation(accountId, conversationId, user.chat_admin_user_id, chatwootToken);
        }
      }
    } catch (assignErr) {
      console.warn("Auto-assign failed (non-fatal):", assignErr.message);
    }

    res.json({ message: messageData });
  } catch (err) {
    res.status(502).json({
      error: "Failed to send message to Chatwoot",
      detail: err.response?.data || err.message,
    });
  }
};

export const markConversationRead = async (req, res) => {
  const { accountId, conversationId } = req.params;

  if (!accountId || !conversationId) {
    return res.status(400).json({ error: "accountId and conversationId are required" });
  }

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }

    await updateLastSeen(accountId, conversationId, chatwootToken);
    res.json({ success: true, message: "Conversation marked as read" });
  } catch (err) {
    res.status(502).json({
      error: "Failed to mark conversation as read",
      detail: err.response?.data || err.message,
    });
  }
};

export const assignConversationToAgent = async (req, res) => {
  const { accountId, conversationId } = req.params;
  const { assignee_id } = req.body;

  if (!accountId || !conversationId || !assignee_id) {
    return res.status(400).json({ error: "accountId, conversationId, and assignee_id are required" });
  }

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }

    const data = await assignConversation(accountId, conversationId, assignee_id, chatwootToken);
    res.json({ success: true, assignment: data });
  } catch (err) {
    res.status(502).json({
      error: "Failed to assign conversation",
      detail: err.response?.data || err.message,
    });
  }
};

export const addInboxMemberToAccount = async (req, res) => {
  const { accountId } = req.params;
  const { inbox_id, user_ids } = req.body;

  if (!accountId || !inbox_id || !user_ids || !Array.isArray(user_ids)) {
    return res.status(400).json({ error: "accountId, inbox_id, and user_ids array are required" });
  }

  try {
    const data = await addInboxMember(accountId, inbox_id, user_ids, process.env.CHATWOOT_PLATFORM_TOKEN);
    res.json({ success: true, data });
  } catch (err) {
    res.status(502).json({
      error: "Failed to add agent to inbox",
      detail: err.response?.data || err.message,
    });
  }
};

export const getChatwootDashboard = async (req, res) => {
  const { accountId } = req.params;
  const { since, until } = req.query;

  if (!since || !until) {
    return res.status(400).json({ error: "since and until are required" });
  }

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }

    const data = await getDashboardData(accountId, chatwootToken, since, until);
    res.json(data);
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch dashboard data from Chatwoot",
      detail: err.response?.data || err.message,
    });
  }
};

export const getContactList = async (req, res) => {
  const { accountId } = req.params;

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await listContacts(accountId, chatwootToken, req.query);
    res.json(data);
  } catch (err) {
    res.status(502).json({
      error: "Failed to list contacts",
      detail: err.response?.data || err.message,
    });
  }
};

export const getContactSearch = async (req, res) => {
  const { accountId } = req.params;
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: "Search query q is required" });
  }

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await searchContacts(accountId, chatwootToken, q);
    res.json(data);
  } catch (err) {
    res.status(502).json({
      error: "Failed to search contacts",
      detail: err.response?.data || err.message,
    });
  }
};

export const postCreateContact = async (req, res) => {
  const { accountId } = req.params;

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await createContact(accountId, chatwootToken, req.body);
    res.status(201).json(data);
  } catch (err) {
    res.status(502).json({
      error: "Failed to create contact",
      detail: err.response?.data || err.message,
    });
  }
};

export const getContactDetail = async (req, res) => {
  const { accountId, contactId } = req.params;

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await getContact(accountId, contactId, chatwootToken);
    res.json(data);
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch contact",
      detail: err.response?.data || err.message,
    });
  }
};

export const putUpdateContact = async (req, res) => {
  const { accountId, contactId } = req.params;

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await updateContact(accountId, contactId, chatwootToken, req.body);
    res.json(data);
  } catch (err) {
    res.status(502).json({
      error: "Failed to update contact",
      detail: err.response?.data || err.message,
    });
  }
};

export const deleteContactById = async (req, res) => {
  const { accountId, contactId } = req.params;

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await deleteContact(accountId, contactId, chatwootToken);
    res.json(data);
  } catch (err) {
    res.status(502).json({
      error: "Failed to delete contact",
      detail: err.response?.data || err.message,
    });
  }
};

export const putBlockContact = async (req, res) => {
  const { accountId, contactId } = req.params;

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await updateContact(accountId, contactId, chatwootToken, { blocked: true });
    res.json(data);
  } catch (err) {
    res.status(502).json({
      error: "Failed to block contact",
      detail: err.response?.data || err.message,
    });
  }
};

export const putMergeContact = async (req, res) => {
  const { accountId } = req.params;
  const { base_contact_id, mergee_contact_id } = req.body;

  if (!base_contact_id || !mergee_contact_id) {
    return res.status(400).json({ error: "base_contact_id and mergee_contact_id are required" });
  }

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await mergeContacts(accountId, chatwootToken, base_contact_id, mergee_contact_id);
    res.json(data);
  } catch (err) {
    res.status(502).json({
      error: "Failed to merge contacts",
      detail: err.response?.data || err.message,
    });
  }
};

export const getContactInboxes = async (req, res) => {
  const { accountId, contactId } = req.params;

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await getContactableInboxes(accountId, contactId, chatwootToken);
    res.json(data);
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch contactable inboxes",
      detail: err.response?.data || err.message,
    });
  }
};

export const postCreateContactInbox = async (req, res) => {
  const { accountId, contactId } = req.params;

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await createContactInbox(accountId, contactId, chatwootToken, req.body);
    res.status(201).json(data);
  } catch (err) {
    res.status(502).json({
      error: "Failed to create contact inbox",
      detail: err.response?.data || err.message,
    });
  }
};

export const getContactConversationList = async (req, res) => {
  const { accountId, contactId } = req.params;

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await getContactConversations(accountId, contactId, chatwootToken);
    res.json(data);
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch contact conversations",
      detail: err.response?.data || err.message,
    });
  }
};
