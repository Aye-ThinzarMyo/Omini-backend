import {
  getCallsByDate,
  getCallRecordings,
  getRecordingFileStream,
} from "../services/freepbx";
import { getKeycloakUser } from "../services/keycloak";
import { User } from "../database/models";
import { decrypt } from "../utils/encryption";

const SIP_DOMAIN = process.env.FREEPBX_SIP_DOMAIN || "172.19.1.216";
const SIP_WS_SERVERS =
  process.env.FREEPBX_SIP_WS_SERVERS || "wss://freepbx-uat.agbisp.net:8089/ws";

export const getSipConfig = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.sub);
    if (!user || !user.freepbx_extension_id) {
      return res
        .status(404)
        .json({ error: "SIP config not found for this user" });
    }

    const extension = user.freepbx_extension_id;
    const password = user.encrypted_freepbx_secret
      ? decrypt(user.encrypted_freepbx_secret)
      : "";

    const sipConfig = {
      domain: SIP_DOMAIN,
      uri: `sip:${extension}@${SIP_DOMAIN}`,
      password,
      wsServers: SIP_WS_SERVERS,
      display_name: extension,
      debug: true,
      session_timers_refresh_method: "invite",
      ice_servers: [{ urls: ["stun:stun.l.google.com:19302"] }],
      hackIpInContact: true,
    };

    res.json({ sip: [sipConfig] });
  } catch (err) {
    console.error("SIP config error:", err.message);
    res
      .status(500)
      .json({ error: "Failed to fetch SIP config", detail: err.message });
  }
};

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
  const {
    limit,
    uniqueid,
    status,
    direction,
    duration_min,
    duration_max,
    startDate,
    endDate,
  } = req.query;

  try {
    const data = await getCallRecordings({
      limit: limit ? parseInt(limit) : undefined,
      uniqueid,
      status,
      direction,
      duration_min,
      duration_max,
      startDate,
      endDate,
    });

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
    const response = await getRecordingFileStream(filename);

    const ct = response.headers["content-type"] || "audio/wav";
    const cl = response.headers["content-length"];
    const cd =
      response.headers["content-disposition"] ||
      `attachment; filename="${filename}"`;

    res.set({
      "Content-Type": ct,
      "Content-Disposition": cd,
    });
    if (cl) res.set("Content-Length", cl);

    response.data.pipe(res);
  } catch (err) {
    console.error("FreePBX recording download error:", err.message);
    res.status(502).json({
      error: "Failed to fetch recording file",
      detail: err.message,
    });
  }
};
