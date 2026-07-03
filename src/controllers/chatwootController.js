import { getInboxes } from "../services/chatwoot";

export const getAccountInboxes = async (req, res) => {
  const { accountId } = req.params;

  if (!accountId) {
    return res.status(400).json({ error: "accountId is required" });
  }

  try {
    // const keycloakToken = req.headers.authorization?.split(" ")[1];
    const keycloakToken = "8frU4gEiBCHn2dNkzH9Xwt8P";
    if (!keycloakToken) {
      return res.status(401).json({ error: "No token provided" });
    }

    const data = await getInboxes(accountId, keycloakToken);
    res.json({ inboxes: data });
  } catch (err) {
    res.status(502).json({
      error: "Failed to fetch inboxes from Chatwoot",
      detail: err.response?.data || err.message,
    });
  }
};
