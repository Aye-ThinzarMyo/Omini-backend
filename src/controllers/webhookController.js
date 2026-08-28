import axios from "axios";
import { notify } from "../services/notifications";
import { User } from "../database/models";
import { getInboxInfo } from "../services/chatwoot";
import { decrypt } from "../utils/encryption";

const CHATWOOT_PLATFORM_TOKEN = process.env.CHATWOOT_PLATFORM_TOKEN;
const CHATWOOT_BASE_URL = process.env.CHATWOOT_BASE_URL;

export const chatbot = async (req, res) => {
  try {
    const { sessionId, chatInput } = req.body;

    if (!sessionId || !chatInput) {
      return res
        .status(400)
        .json({ error: "sessionId and chatInput are required" });
    }

    const botUrl = process.env.BOT_WEBHOOK_URL;
    if (!botUrl) {
      return res.status(500).json({ error: "BOT_WEBHOOK_URL not configured" });
    }

    const { data } = await axios.post(
      botUrl,
      { sessionId, chatInput },
      { timeout: 30000 },
    );

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({
      error: "Agent execution failed",
      details: err.response?.data || err.message,
    });
  }
};

// Resolve the assigned human agent id from conversation meta, or null if
// unassigned / assigned to an AgentBot.
function resolveHumanAssignee(conversation) {
  if (!conversation) return null;
  const meta = conversation.meta || {};
  const assigneeType = meta.assignee_type || meta.assignee?.type;
  const isBot =
    assigneeType === "AgentBot" ||
    assigneeType === "agent_bot" ||
    meta.assignee?.type === "agent_bot";
  if (isBot) return null;
  const assigneeId = meta.assignee?.id || conversation.assignee_id;
  return assigneeId || null;
}

// Chatwoot webhook receiver — pushes events to connected users via SSE
export const chatwootWebhook = async (req, res) => {
  console.log("Headers:", req.headers);
  console.log("Body:", JSON.stringify(req.body));
  // Always respond 200 immediately so Chatwoot doesn't retry
  res.status(200).json({ status: "ok" });

  try {
    const event = req.body?.event;
    // For Chatwoot v5+, the whole body is the payload (no nested "payload" wrapper)
    const payload = req.body?.payload || req.body;

    if (!event) return;

    // Process async so response isn't delayed
    setImmediate(() => processChatwootEvent(event, payload));
  } catch (err) {
    console.error("Chatwoot webhook error:", err.message);
  }
};

async function processChatwootEvent(event, payload) {
  console.log("📥 Chatwoot event:", event);
  switch (event) {
    case "message_created":
      await handleNewMessage(payload);
      break;
    case "conversation_created":
      await handleNewConversation(payload);
      break;
    case "conversation_updated":
      await handleConversationUpdated(payload);
      break;
    case "conversation_status_changed":
      await handleConversationUpdated(payload);
      break;
    case "conversation_assignee_updated":
      await handleAssigneeUpdated(payload);
      break;
    default:
      break;
  }
}

async function handleNewMessage(payload) {
  const message = payload?.message || payload;
  const conversation = payload?.conversation;

  // Skip bot messages and agent messages — only notify on incoming customer messages
  const msgType = message?.message_type;
  const isIncoming =
    typeof msgType === "string" ? msgType === "incoming" : msgType === 0;
  if (!isIncoming) return; // 0 = incoming

  // Resolve assignee: meta.assignee holds { id, name, type } where type is
  // "User" for humans or "AgentBot" for bots.
  const assigneeId = resolveHumanAssignee(conversation);
  if (!assigneeId) {
    // Unassigned / bot-owned message → alert all administrators.
    console.log("=== UNASSIGNED MESSAGE ===", {
      event: "message_created",
      conversationId: conversation?.id,
      messageId: message?.id,
    });

    const admins = await User.findAll({
      where: { role: "administrator" },
      attributes: ["id", "full_name"],
    });

    const senderName =
      payload?.sender?.name || payload?.contact?.name || "Customer";
    const content = message?.content?.slice(0, 200) || "Sent an attachment";
    const inboxId = conversation?.inbox_id ?? payload?.inbox?.id;
    let inboxName = payload?.inbox?.name;
    let channel = conversation?.channel || payload?.inbox?.channel;

    // Enrich inbox name/channel from Chatwoot if missing, using an admin's token.
    if (inboxId && (!inboxName || !channel) && admins.length > 0) {
      const cleanAdmin = await User.findByPk(admins[0].id, {
        attributes: ["id", "encrypted_chat_secret"],
      });
      let token = CHATWOOT_PLATFORM_TOKEN;
      if (cleanAdmin?.encrypted_chat_secret) {
        try {
          token = decrypt(cleanAdmin.encrypted_chat_secret);
        } catch {
          // fall back to platform token
        }
      }
      const info = await getInboxInfo(
        conversation?.account_id || payload?.account?.id || 40,
        inboxId,
        token,
      );
      if (info) {
        inboxName = inboxName || info.name;
        channel = channel || info.channelType;
      }
    }

    for (const admin of admins) {
      notify(admin.id, {
        type: "unassigned_message",
        title: `Unassigned message from ${senderName}`,
        message: content,
        data: {
          conversationId: conversation?.id,
          messageId: message?.id,
          sender: senderName,
          content,
          inboxId,
          inboxName,
          channel,
        },
      });
    }
    return;
  }

  console.log("=== NOTIFYING MESSAGE ===", {
    event: "message_created",
    assigneeId,
    conversationId: conversation?.id,
    messageId: message?.id,
  });

  const users = await User.findAll({
    where: { chat_admin_user_id: assigneeId },
    attributes: ["id", "full_name"],
  });

  const senderName =
    payload?.sender?.name || payload?.contact?.name || "Customer";
  const content = message?.content?.slice(0, 200) || "Sent an attachment";
  const inboxId = conversation?.inbox_id ?? payload?.inbox?.id;
  let inboxName = payload?.inbox?.name;
  let channel = conversation?.channel || payload?.inbox?.channel;

  // If the payload doesn't include inbox name/channel, enrich from Chatwoot
  // using a user token (platform token can't access /inboxes/{id}).
  if (inboxId && (!inboxName || !channel)) {
    // Prefer the assignee's user token for the inbox lookup.
    let token = CHATWOOT_PLATFORM_TOKEN;
    if (users.length > 0) {
      const cleanUser = await User.findByPk(users[0].id, {
        attributes: ["id", "encrypted_chat_secret"],
      });
      if (cleanUser?.encrypted_chat_secret) {
        try {
          token = decrypt(cleanUser.encrypted_chat_secret);
        } catch (e) {
          // fall through to platform token
        }
      }
    }

    const info = await getInboxInfo(
      conversation?.account_id || payload?.account?.id || 40,
      inboxId,
      token,
    );
    if (info) {
      inboxName = inboxName || info.name;
      channel = channel || info.channelType;
    }
  }

  for (const user of users) {
    notify(user.id, {
      type: "new_message",
      title: `New message from ${senderName}`,
      message: content,
      data: {
        conversationId: conversation?.id,
        messageId: message?.id,
        sender: senderName,
        content,
        inboxId,
        inboxName,
        channel,
      },
    });
  }
}

async function handleNewConversation(payload) {
  const conversation = payload?.conversation || payload;
  const assigneeId = resolveHumanAssignee(conversation);
  if (!assigneeId) return;

  const users = await User.findAll({
    where: { chat_admin_user_id: assigneeId },
    attributes: ["id", "full_name"],
  });

  const senderName =
    payload?.sender?.name || payload?.contact?.name || "Customer";

  for (const user of users) {
    notify(user.id, {
      type: "conversation_created",
      title: `New conversation from ${senderName}`,
      message: `Conversation #${conversation?.id} assigned to you`,
      data: {
        conversationId: conversation?.id,
        sender: senderName,
        inboxId: conversation?.inbox_id ?? payload?.inbox?.id,
        inboxName: payload?.inbox?.name,
        channel: conversation?.channel || payload?.inbox?.channel,
      },
    });
  }
}

async function handleConversationUpdated(payload) {
  const conversation = payload?.conversation || payload;
  const assigneeId = resolveHumanAssignee(conversation);
  if (!assigneeId) return;

  const users = await User.findAll({
    where: { chat_admin_user_id: assigneeId },
    attributes: ["id", "full_name"],
  });

  for (const user of users) {
    notify(user.id, {
      type: "conversation_updated",
      title: "Conversation updated",
      message: `Conversation #${conversation?.id} status: ${conversation?.status || "updated"}`,
      data: {
        conversationId: conversation?.id,
        status: conversation?.status,
        inboxId: conversation?.inbox_id ?? payload?.inbox?.id,
        inboxName: payload?.inbox?.name,
        channel: conversation?.channel || payload?.inbox?.channel,
      },
    });
  }
}

async function handleAssigneeUpdated(payload) {
  const conversation = payload?.conversation || payload;
  const newAssigneeId = resolveHumanAssignee(conversation);
  if (!newAssigneeId) return;

  const users = await User.findAll({
    where: { chat_admin_user_id: assigneeId },
    attributes: ["id", "full_name"],
  });
  console.log(
    "=== USERS FOUND ===",
    newAssigneeId,
    users.length,
    users.map((u) => u.id),
  );

  for (const user of users) {
    notify(user.id, {
      type: "conversation_assigned",
      title: "Conversation assigned to you",
      message: `Conversation #${conversation?.id} has been assigned to you`,
      data: {
        conversationId: conversation?.id,
      },
    });
  }
}
