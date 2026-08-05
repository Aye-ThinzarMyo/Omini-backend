import { setupSse, agentConnect, observerConnect } from "../services/presence";

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
