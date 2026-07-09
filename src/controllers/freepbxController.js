import { getCallsByDate, getCallRecordings, getRecordingDownloadUrl } from "../services/freepbx";

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
  try {
    const data = await getCallRecordings();

    const total = data.length;
    const answered = data.filter((c) => c.disposition === "ANSWERED").length;
    const missed = data.filter(
      (c) =>
        c.disposition === "NO ANSWER" ||
        c.disposition === "BUSY" ||
        c.disposition === "FAILED" ||
        c.disposition === "CANCELED",
    ).length;
    const outbound = data.filter((c) => c.dcontext === "from-internal").length;
    const inbound = data.filter(
      (c) => c.dcontext !== "from-internal" && c.dcontext !== "ext-local",
    ).length;

    res.json({
      recordings: data,
      stats: { total, answered, missed, inbound, outbound },
    });
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

export const getRecordingFile = async (req, res) => {
  const { filename } = req.query;

  if (!filename) {
    return res.status(400).json({ error: "filename query param is required" });
  }

  try {
    const url = getRecordingDownloadUrl(filename);
    res.json({ download_url: url });
  } catch (err) {
    console.error("FreePBX recording URL error:", err.message);
    res.status(502).json({
      error: "Failed to get recording download URL",
      detail: err.message,
    });
  }
};
