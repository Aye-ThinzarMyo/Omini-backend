import { getAccountUsers } from "../services/chatwoot";

export const getAllAccountUsers = async (req, res) => {
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
