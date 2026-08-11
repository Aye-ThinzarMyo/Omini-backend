import { User } from "../database/models";
import { Op } from "sequelize";
import {
  getInboxes,
  getProfile,
  updateProfile,
  getAccountUsers,
  getConversations,
  getConversation,
  getAgents,
  getAccount,
  getReport,
  getDashboardData,
  getMessages,
  sendMessage,
  assignConversation,
  updateLastSeen,
  addInboxMember,
  listContacts,
  searchContacts,
  createContact,
  getContact,
  updateContact,
  deleteContact,
  mergeContacts,
  getContactableInboxes,
  createContactInbox,
  getContactConversations,
  createConversation,
  startConversationAndSendMessage,
  getUserPlatform,
  updateAccountPlatform,
  getAccountPlatform,
} from "../services/chatwoot";
import { sendCsv } from "../utils/csv";
import { decrypt, encrypt } from "../utils/encryption";
import { resetKeycloakPassword } from "../services/keycloak";
import { fetchContactData, contactFromBody } from "../services/auditLog";
import multer from "multer";
import FormData from "form-data";

const upload = multer({ storage: multer.memoryStorage() });

export { upload };

async function getReportRows(accountId, req, metric) {
  const { since, until, type, id } = req.query;
  if (!since || !until) {
    throw Object.assign(
      new Error("since and until are required (YYYY-MM-DD)"),
      {
        statusCode: 400,
      },
    );
  }

  const chatwootToken = await getDecryptedChatToken(req);
  if (!chatwootToken) {
    throw Object.assign(
      new Error("No Chatwoot API key found for your account"),
      {
        statusCode: 403,
      },
    );
  }

  const data = await getReport(accountId, chatwootToken, {
    metric,
    type: type || "account",
    since: toEpochSeconds(since),
    until: toEpochSeconds(until, true),
    id,
  });

  const rows = [["Date", "Value"]];
  for (const item of data || []) {
    const date =
      item.date ||
      (item.timestamp
        ? new Date(item.timestamp * 1000).toISOString().slice(0, 10)
        : "");
    rows.push([date, item.value]);
  }
  return rows;
}

async function requireChatToken(req) {
  const chatwootToken = await getDecryptedChatToken(req);
  if (!chatwootToken) {
    throw Object.assign(
      new Error("No Chatwoot API key found for your account"),
      {
        statusCode: 403,
      },
    );
  }
  return chatwootToken;
}

export const exportOutgoingMessages = async (req, res) => {
  const { accountId } = req.params;
  try {
    const rows = await getReportRows(accountId, req, "outgoing_messages_count");
    const { since, until } = req.query;
    sendCsv(res, rows, `outgoing-messages-${since}-to-${until}.csv`);
  } catch (err) {
    if (err.statusCode)
      return res.status(err.statusCode).json({ error: err.message });
    res.status(502).json({
      error: "Failed to export outgoing messages",
      detail: err.response?.data || err.message,
    });
  }
};

export const exportIncomingMessages = async (req, res) => {
  const { accountId } = req.params;
  try {
    const rows = await getReportRows(accountId, req, "incoming_messages_count");
    const { since, until } = req.query;
    sendCsv(res, rows, `incoming-messages-${since}-to-${until}.csv`);
  } catch (err) {
    if (err.statusCode)
      return res.status(err.statusCode).json({ error: err.message });
    res.status(502).json({
      error: "Failed to export incoming messages",
      detail: err.response?.data || err.message,
    });
  }
};

export const exportConversations = async (req, res) => {
  const { accountId } = req.params;
  try {
    const rows = await getReportRows(accountId, req, "conversations_count");
    const { since, until } = req.query;
    sendCsv(res, rows, `conversations-${since}-to-${until}.csv`);
  } catch (err) {
    if (err.statusCode)
      return res.status(err.statusCode).json({ error: err.message });
    res.status(502).json({
      error: "Failed to export conversations",
      detail: err.response?.data || err.message,
    });
  }
};

export const exportChannelTraffic = async (req, res) => {
  const { accountId } = req.params;
  const { since, until } = req.query;

  if (!since || !until) {
    return res
      .status(400)
      .json({ error: "since and until are required (YYYY-MM-DD)" });
  }

  try {
    const chatwootToken = await requireChatToken(req);
    const data = await getDashboardData(
      accountId,
      chatwootToken,
      toEpochSeconds(since),
      toEpochSeconds(until, true),
    );

    const rows = [
      ["Channel", "Type", "Conversations"],
      ...(data.channels || []).map((c) => [c.name, c.channelType, c.total]),
    ];
    sendCsv(res, rows, `traffic-by-channel-${since}-to-${until}.csv`);
  } catch (err) {
    if (err.statusCode)
      return res.status(err.statusCode).json({ error: err.message });
    res.status(502).json({
      error: "Failed to export channel traffic",
      detail: err.response?.data || err.message,
    });
  }
};

export const exportContacts = async (req, res) => {
  const { accountId } = req.params;
  const { pageSize } = req.query;

  try {
    const chatwootToken = await requireChatToken(req);
    const data = await listContacts(accountId, chatwootToken, {
      page: 1,
      pageSize: pageSize ? parseInt(pageSize) : 10000,
    });

    const contacts = data?.payload ?? [];
    const rows = [["Id", "Name", "Email", "Phone", "Status", "Created At"]];
    for (const c of contacts) {
      rows.push([
        c.id,
        c.name,
        c.email,
        c.phone_number || c.additional_attributes?.phone_number || "",
        c.status || "",
        c.created_at || "",
      ]);
    }
    sendCsv(res, rows, "contacts-export.csv");
  } catch (err) {
    if (err.statusCode)
      return res.status(err.statusCode).json({ error: err.message });
    res.status(502).json({
      error: "Failed to export contacts",
      detail: err.response?.data || err.message,
    });
  }
};

export const getAccountInboxes = async (req, res) => {
  const { accountId } = req.params;

  if (!accountId) {
    return res.status(400).json({ error: "accountId is required" });
  }

  try {
    const user = await User.findByPk(req.user.sub);
    if (!user || !user.encrypted_chat_secret) {
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
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

export const getChatwootProfile = async (req, res) => {
  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await getProfile(chatwootToken);
    res.json(data);
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch Chatwoot profile",
      detail: err.response?.data || err.message,
    });
  }
};

export const updateChatwootProfile = async (req, res) => {
  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await updateProfile(chatwootToken, req.body);

    const profile = req.body?.profile || {};
    if (profile.password) {
      const user = await User.findByPk(req.user.sub);
      if (user) {
        await resetKeycloakPassword(user.id, profile.password);
        await user.update({ password: encrypt(profile.password) });
      }
    }

    res.json(data);
  } catch (err) {
    res.status(502).json({
      error: "Failed to update Chatwoot profile",
      detail: err.response?.data || err.message,
    });
  }
};

// Chatwoot v2 reports expect unix timestamps (seconds). Accept either
// YYYY-MM-DD strings or raw epoch seconds and normalize.
function toEpochSeconds(value, endOfDay = false) {
  if (!value) return value;
  const m = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const ms = Date.UTC(
      +m[1],
      +m[2] - 1,
      +m[3],
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
    );
    return Math.floor(ms / 1000);
  }
  return /^\d+$/.test(String(value)) ? Number(value) : value;
}

export const getConversationsList = async (req, res) => {
  const { accountId } = req.params;

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
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
    return res
      .status(400)
      .json({ error: "accountId and conversationId are required" });
  }

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
    }

    const data = await getConversation(
      accountId,
      conversationId,
      chatwootToken,
    );
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
  const { q } = req.query;

  try {
    const where = {};
    if (q) {
      where[Op.or] = [
        { full_name: { [Op.iLike]: `%${q}%` } },
        { email: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const users = await User.findAll({
      where,
      attributes: [
        "id",
        "chat_admin_user_id",
        "full_name",
        "email",
        "role",
        "department",
        "phone",
        // "status",
      ],
    });

    res.json({ agents: users });
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch agents",
      detail: err.message,
    });
  }
};

export const getChatwootAccountDetail = async (req, res) => {
  const { accountId } = req.params;

  if (!accountId) {
    return res.status(400).json({ error: "accountId is required" });
  }

  try {
    const data = await getAccountPlatform(accountId);
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
    return res
      .status(400)
      .json({ error: "metric, type, since, and until are required" });
  }

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
    }

    const data = await getReport(accountId, chatwootToken, {
      metric,
      type,
      since,
      until,
      id,
    });
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
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
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
  const {
    content,
    private: isPrivate,
    content_type,
    content_attributes,
  } = req.body;

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
    }

    let messageData;

    if (req.files && req.files.length > 0) {
      const fd = new FormData();
      if (content) fd.append("content", content);
      if (isPrivate !== undefined) fd.append("private", isPrivate);
      if (content_type) fd.append("content_type", content_type);
      if (content_attributes) {
        fd.append("content_attributes", JSON.stringify(content_attributes));
      }
      for (const file of req.files) {
        fd.append("attachments[]", file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype,
        });
      }
      messageData = await sendMessage(
        accountId,
        conversationId,
        chatwootToken,
        fd,
        true,
      );
    } else {
      if (!content) {
        return res
          .status(400)
          .json({ error: "content is required when no file is attached" });
      }

      const payload = { content };
      if (isPrivate !== undefined) payload.private = isPrivate;
      if (content_type) payload.content_type = content_type;
      if (content_attributes) {
        payload.content_attributes = content_attributes;
      }

      messageData = await sendMessage(
        accountId,
        conversationId,
        chatwootToken,
        payload,
      );
    }

    // Auto-assign conversation to the replying agent if unassigned
    try {
      const conv = await getConversation(
        accountId,
        conversationId,
        chatwootToken,
      );
      const convData = conv?.data || conv?.payload || conv || {};
      if (!convData.assignee_id) {
        const user = await User.findByPk(req.user.sub);
        if (user?.chat_admin_user_id) {
          await assignConversation(
            accountId,
            conversationId,
            user.chat_admin_user_id,
            chatwootToken,
          );
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
    return res
      .status(400)
      .json({ error: "accountId and conversationId are required" });
  }

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
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

  if (!accountId || !conversationId) {
    return res.status(400).json({
      error: "accountId and conversationId are required",
    });
  }

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
    }

    const data = await assignConversation(
      accountId,
      conversationId,
      assignee_id,
      chatwootToken,
    );
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
    return res
      .status(400)
      .json({ error: "accountId, inbox_id, and user_ids array are required" });
  }

  try {
    const data = await addInboxMember(
      accountId,
      inbox_id,
      user_ids,
      process.env.CHATWOOT_PLATFORM_TOKEN,
    );
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
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
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
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
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
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
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
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
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
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
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
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
    }

    const trackedFields = [
      "name",
      "email",
      "phone_number",
      "company_name",
    ];
    const labelMap = {
      name: "name",
      email: "email",
      phone_number: "phone number",
      company_name: "company",
    };
    const getValue = (contact, f) =>
      f === "company_name"
        ? contact?.additional_attributes?.company_name ?? ""
        : contact?.[f] ?? "";
    const beforeContact = await fetchContactData(accountId, contactId, req);
    const before = {};
    if (beforeContact) {
      for (const f of trackedFields) before[f] = getValue(beforeContact, f);
    }

    const data = await updateContact(
      accountId,
      contactId,
      chatwootToken,
      req.body,
    );

    const afterContact = contactFromBody(data);
    const after = {};
    if (afterContact) {
      for (const f of trackedFields) after[f] = getValue(afterContact, f);
    }

    const changes =
      beforeContact && afterContact
        ? trackedFields
            .filter((f) => String(before[f] ?? "") !== String(after[f] ?? ""))
            .map(
              (f) =>
                `${labelMap[f]} from ${before[f] || "(empty)"} to ${after[f] || "(empty)"}`,
            )
        : [];

    res.locals.contactUpdateDescription = changes.length
      ? `${changes.join(", ")} at ${afterContact?.name || "(unknown)"}`
      : undefined;
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
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
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
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await updateContact(accountId, contactId, chatwootToken, {
      blocked: req.body?.blocked !== false,
    });
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
    return res
      .status(400)
      .json({ error: "base_contact_id and mergee_contact_id are required" });
  }

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await mergeContacts(
      accountId,
      chatwootToken,
      base_contact_id,
      mergee_contact_id,
    );
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
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await getContactableInboxes(
      accountId,
      contactId,
      chatwootToken,
    );
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
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await createContactInbox(
      accountId,
      contactId,
      chatwootToken,
      req.body,
    );
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
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await getContactConversations(
      accountId,
      contactId,
      chatwootToken,
    );
    res.json(data);
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch contact conversations",
      detail: err.response?.data || err.message,
    });
  }
};

export const postCreateConversation = async (req, res) => {
  const { accountId } = req.params;

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await createConversation(accountId, chatwootToken, req.body);
    res.status(201).json(data);
  } catch (err) {
    res.status(502).json({
      error: "Failed to create conversation",
      detail: err.response?.data || err.message,
    });
  }
};

export const postStartConversation = async (req, res) => {
  const { accountId } = req.params;

  try {
    const chatwootToken = await getDecryptedChatToken(req);
    if (!chatwootToken) {
      return res
        .status(403)
        .json({ error: "No Chatwoot API key found for your account" });
    }
    const data = await startConversationAndSendMessage(
      accountId,
      chatwootToken,
      req.body,
    );
    res.status(201).json(data);
  } catch (err) {
    res.status(502).json({
      error: "Failed to start conversation",
      detail: err.response?.data || err.message,
    });
  }
};

export const getUserDetail = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findOne({ where: { chat_admin_user_id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const userData = user.toJSON();
    delete userData.encrypted_chat_secret;
    delete userData.password;
    res.json({ user: userData });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch user", detail: err.message });
  }
};

export const updateChatwootAccount = async (req, res) => {
  const { accountId } = req.params;
  const {
    name,
    locale,
    domain,
    support_email,
    status,
    limits,
    custom_attributes,
    phone,
  } = req.body;

  try {
    const payload = {};
    if (name) payload.name = name;
    if (locale) payload.locale = locale;
    if (domain) payload.domain = domain;
    if (support_email) payload.support_email = support_email;
    if (status) payload.status = status;
    if (limits) payload.limits = limits;
    if (custom_attributes || phone) {
      payload.custom_attributes = { ...custom_attributes };
      if (phone) payload.custom_attributes.phone_number = phone;
    }

    const data = await updateAccountPlatform(accountId, payload);
    res.json({ account: data });
  } catch (err) {
    res.status(502).json({
      error: "Failed to update account",
      detail: err.response?.data || err.message,
    });
  }
};
