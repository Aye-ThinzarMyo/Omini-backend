import { User } from "../database/models";
import { getInboxes, getAccountUsers } from "../services/chatwoot";
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
