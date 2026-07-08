import { User } from "../database/models";
import { getInboxes, getAccountUsers, getConversations, getConversation, getAgents, getAccount, getReport, getDashboardData } from "../services/chatwoot";
import { decrypt } from "../utils/encryption";

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
