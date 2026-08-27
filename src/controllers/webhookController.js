import axios from "axios";
import { notify } from "../services/notifications";
import { User } from "../database/models";

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

// Chatwoot webhook receiver — pushes events to connected users via SSE
export const chatwootWebhook = async (req, res) => {
  console.log("🔔 Webhook Request Received:", new Date().toISOString());
  console.log("Headers:", req.headers);
  console.log("Body:", JSON.stringify(req.body));
  // Always respond 200 immediately so Chatwoot doesn't retry
  res.status(200).json({ status: "ok" });

  try {
    const event = req.body?.event;
    const payload = req.body?.payload;

    if (!event || !payload) return;

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

  // Only notify when assigned to a human agent (skip AgentBot / unassigned)
  const assigneeId = conversation?.assignee_id;
  if (!assigneeId) return;

  const users = await User.findAll({
    where: { chat_admin_user_id: assigneeId },
    attributes: ["id", "full_name"],
  });

  const senderName =
    payload?.sender?.name || payload?.contact?.name || "Customer";
  const content = message?.content?.slice(0, 200) || "Sent an attachment";

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
      },
    });
  }
}

async function handleNewConversation(payload) {
  const conversation = payload?.conversation || payload;
  const assigneeId = conversation?.assignee_id;
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
      },
    });
  }
}

async function handleConversationUpdated(payload) {
  const conversation = payload?.conversation || payload;
  const assigneeId = conversation?.assignee_id;
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
      },
    });
  }
}

async function handleAssigneeUpdated(payload) {
  const conversation = payload?.conversation || payload;
  const newAssigneeId = conversation?.assignee_id;
  if (!newAssigneeId) return;

  const users = await User.findAll({
    where: { chat_admin_user_id: newAssigneeId },
    attributes: ["id", "full_name"],
  });

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
