import { getCallsByDate, getCallRecordings } from "../services/freepbx";

export const getCallChart = async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res
      .status(400)
      .json({ error: "startDate and endDate are required (YYYY-MM-DD)" });
  }

  try {
    const data = await getCallsByDate(startDate, endDate);
    res.json({ calls: data });
  } catch (err) {
    console.error(
      "FreePBX call chart error:",
      err.response?.data || err.message,
    );
    res.status(502).json({
      error: "Failed to fetch call data from FreePBX",
      detail: err.response?.data || err.message,
    });
  }
};

export const getCallRecordingsList = async (req, res) => {
  const { extension, limit } = req.query;

  try {
    const data = await getCallRecordings();
    res.json({ recordings: data });
  } catch (err) {
    console.error(
      "FreePBX recordings error:",
      err.response?.data || err.message,
    );
    res.status(502).json({
      error: "Failed to fetch recordings from FreePBX",
      detail: err.response?.data || err.message,
    });
  }
};
