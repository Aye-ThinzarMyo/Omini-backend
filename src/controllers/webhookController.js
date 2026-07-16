import { Op } from "sequelize";
import { decrypt } from "../utils/encryption";
import { User } from "../database/models";
import { findOrCreateContact } from "../services/chatwoot";

export const chatwootWebhook = async (req, res) => {
  const event = req.body;

  if (!event || !event.event) {
    return res.status(400).json({ error: "Invalid webhook payload" });
  }

  console.log("Chatwoot webhook:", event.event);

  if (event.event === "conversation_created") {
    const conversation = event.data?.conversation;
    const contact = event.data?.contact;
    const accountId = event.data?.account?.id;

    if (accountId && contact && conversation?.inbox_id) {
      try {
        const adminUser = await User.findOne({
          where: { chat_admin_user_id: { [Op.ne]: null } },
        });

        if (adminUser?.encrypted_chat_secret) {
          const token = decrypt(adminUser.encrypted_chat_secret);
          await findOrCreateContact(accountId, token, {
            email: contact.email,
            phone_number: contact.phone_number,
            name: contact.name,
            inbox_id: conversation.inbox_id,
          });
        }
      } catch (err) {
        console.error("Webhook error:", err.message);
      }
    }
  }

  res.json({ received: true });
};
