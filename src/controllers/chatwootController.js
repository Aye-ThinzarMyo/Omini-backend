import { User } from "../database/models";
import { getInboxes, getAccountUsers, getConversations, getConversation, getAgents, getAccount, getReport, getDashboardData, getMessages, sendMessage, assignConversation, updateLastSeen, addInboxMember } from "../services/chatwoot";
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
  const { assignee_type, inbox_id, q, status } = req.query;

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res.status(403).json({ error: "No Chatwoot API key found for your account" });
    }

    const filters = {};
    if (assignee_type) filters.assignee_type = assignee_type;
    if (inbox_id) filters.inbox_id = inbox_id;
    if (q) filters.q = q;
    if (status) filters.status = status;

    const data = await getConversations(accountId, chatwootToken, filters);
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
