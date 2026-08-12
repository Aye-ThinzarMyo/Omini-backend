import "dotenv/config";
import { Op } from "sequelize";
import { decrypt } from "../utils/encryption";
import { User } from "../database/models";
import { createContact } from "../services/chatwoot";
import {
  generateBotReply,
  sendBotReply,
  handoffToHuman,
  THRESHOLD,
} from "../services/bot";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export const chatwootWebhook = async (req, res) => {
  const event = req.body;

  if (!event || !event.event) {
    return res.status(400).json({ error: "Invalid webhook payload" });
  }

  if (WEBHOOK_SECRET) {
    const token =
      req.query.webhook_token ||
      req.query.token ||
      req.headers["x-webhook-token"];
    if (token !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Invalid webhook token" });
    }
  }

  try {
    if (event.event === "conversation_created") {
      await syncContactFromConversation(event);
    }

    if (event.event === "message_created") {
      await handleMessageCreated(event);
    }
  } catch (err) {
    console.error("Webhook processing error:", err.message);
  }

  res.json({ received: true });
};

async function syncContactFromConversation(event) {
  const conversation = event.data?.conversation;
  const contact = event.data?.contact;
  const accountId = event.data?.account?.id;

  if (accountId && contact && conversation?.inbox_id) {
    const adminUser = await User.findOne({
      where: { chat_admin_user_id: { [Op.ne]: null } },
    });

    if (adminUser?.encrypted_chat_secret) {
      const token = decrypt(adminUser.encrypted_chat_secret);
      await createContact(accountId, token, {
        email: contact.email,
        phone_number: contact.phone_number,
        name: contact.name,
        inbox_id: conversation.inbox_id,
      });
    }
  }
}

async function handleMessageCreated(event) {
  const message = event.data?.message;
  const conversation = event.data?.conversation;
  const accountId = event.data?.account?.id;

  if (!message || !conversation || !accountId) return;
  if (message.sender_type !== "Contact") return;
  if (!message.content) return;

  const text = message.content.trim();

  const { reply, confidence } = await generateBotReply(text);

  if (reply && confidence >= THRESHOLD) {
    await sendBotReply(accountId, conversation.id, reply);
    console.log(`[BOT] replied to conversation ${conversation.id}`);
  } else {
    await handoffToHuman(accountId, conversation.id);
    console.log(`[BOT] handed off conversation ${conversation.id} to human`);
  }
}
