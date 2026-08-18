import axios from "axios";

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
