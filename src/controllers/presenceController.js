import { setupSse, agentConnect, observerConnect, getOnlineAgents } from "../services/presence";

export const agentPresenceStream = async (req, res) => {
  setupSse(res);
  try {
    await agentConnect(req.user.sub, res);
  } catch (err) {
    console.error("Agent presence stream error:", err);
    res.end();
  }
};

export const presenceObserverStream = async (req, res) => {
  setupSse(res);
  try {
    await observerConnect(res);
  } catch (err) {
    console.error("Presence observer error:", err);
    res.end();
  }
};

export const getPresenceStatus = async (req, res) => {
  try {
    const agents = await getOnlineAgents();
    res.json({
      online: agents.map((a) => a.id),
      agents,
    });
  } catch (err) {
    console.error("Presence status error:", err);
    res.status(502).json({
      error: "Failed to fetch presence status",
      detail: err.response?.data || err.message,
    });
  }
};
