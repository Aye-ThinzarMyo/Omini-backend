import { User } from "../database/models";
import { notify } from "../services/notifications";

export const chatwootWebhook = async (req, res) => {
  try {
    const body = req.body || {};
    const data = body.data || body;

    if (body.event === "message_created") {
      const message = data.message || null;
      const senderType =
        message?.sender_type ||
        data.sender_type ||
        (data.message_type === "incoming" ? "Contact" : null);

      // Only notify for customer messages (never for agent or bot messages)
      if (senderType === "Contact") {
        const conversation = data.conversation || {};
        const assignee =
          conversation?.assignee || conversation?.meta?.assignee || null;
        const assigneeId = assignee?.id;

        if (assigneeId) {
          const agent = await User.findOne({
            where: { chat_admin_user_id: assigneeId },
          });
          if (agent) {
            const contactName =
              message?.sender?.name ||
              data.sender?.name ||
              data.contact?.name ||
              "Customer";
            const text = message?.content || data.content || "";

            notify(agent.id, {
              type: "chat.message",
              title: `New message from ${contactName}`,
              message: text || "You have a new message",
              data: {
                conversationId: conversation.id,
                accountId: data.account?.id,
              },
            });
          }
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    res.status(200).json({ received: true });
  }
};
