import {
  getCallsByDate,
  getCallRecordings,
  getRecordingDownloadUrl,
  getRingGroups,
  getRecordingFileStream,
} from "../services/freepbx";
import { getKeycloakUser } from "../services/keycloak";
import { User } from "../database/models";
import { decrypt } from "../utils/encryption";

// SIP realm + WebSocket endpoint are environment-only — no hardcoded fallback,
// so a misconfigured deploy fails loudly at the first sip-config request
// instead of silently registering against the wrong PBX.
const SIP_DOMAIN = process.env.FREEPBX_SIP_DOMAIN;
const SIP_WS_SERVERS = process.env.FREEPBX_SIP_WS_SERVERS;

export const getSipConfig = async (req, res) => {
  try {
    if (!SIP_DOMAIN || !SIP_WS_SERVERS) {
      return res.status(500).json({
        error:
          "SIP config unavailable: set FREEPBX_SIP_DOMAIN and FREEPBX_SIP_WS_SERVERS in the backend .env",
      });
    }

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

export const exportCallChart = async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res
      .status(400)
      .json({ error: "startDate and endDate are required (YYYY-MM-DD)" });
  }

  try {
    const data = await getCallsByDate(startDate, endDate);

    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Date", "Calls"],
      ...data.map(({ date, count }) => [date, count]),
    ];
    const csv = "\uFEFF" + rows.map((r) => r.join(",")).join("\r\n");

    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="calls-chart-${startDate}-to-${endDate}.csv"`,
    });
    res.send(csv);
  } catch (err) {
    console.error(
      "FreePBX call chart export error:",
      err.response?.data || err.message,
    );
    res.status(502).json({
      error: "Failed to export call data from FreePBX",
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
const MONITOR_MODES = ["spy", "whisper", "barge"];

// Roles (app or Keycloak) allowed to monitor a live call. Server-authoritative;
// the frontend gate is convenience only (see plan §7).
const MONITOR_ROLES = ["admin", "administrator", "superadmin", "supervisor"];

const featureCodeForMode = (mode) => {
  const map = {
    spy: process.env.FREEPBX_FEATURECODE_SPY,
    whisper: process.env.FREEPBX_FEATURECODE_WHISPER,
    barge: process.env.FREEPBX_FEATURECODE_BARGE,
  };
  return map[mode];
};

// Phase 1 ChanSpy — validate + resolve the ChanSpy feature-code dial string.
// The backend does NOT place the call; it returns the string the supervisor's
// existing WebRTC softphone dials (`useSip.call(dialString)`), keeping RBAC and
// audit server-side while reusing the WebRTC leg. See plan §4.2.
export const getMonitorTarget = async (req, res) => {
  try {
    const { agentUserId, agentExtension } = req.body || {};

    const mode = String(req.body?.mode || "spy").toLowerCase();
    if (!MONITOR_MODES.includes(mode)) {
      return res
        .status(400)
        .json({ error: "Invalid mode; expected spy | whisper | barge" });
    }

    // RBAC — allow only Admin / Supervisor; deny by default. Check both the app
    // User.role and Keycloak realm roles.
    const dbUser = await User.findByPk(req.user?.sub);
    const appRole = String(dbUser?.role || "").toLowerCase();
    const kcRoles = (req.user?.roles || []).map((r) => String(r).toLowerCase());
    const allowed =
      MONITOR_ROLES.includes(appRole) ||
      kcRoles.some((r) => MONITOR_ROLES.includes(r));
    if (!allowed) {
      return res.status(403).json({
        error: "Forbidden: monitoring requires Admin or Supervisor role",
      });
    }

    // Resolve target extension: raw extension wins; else look up the agent user.
    let ext = agentExtension ? String(agentExtension).trim() : "";
    if (!ext && agentUserId) {
      const agent = await User.findByPk(agentUserId);
      if (!agent || !agent.freepbx_extension_id) {
        return res
          .status(404)
          .json({ error: "Agent extension not found for the given user" });
      }
      ext = String(agent.freepbx_extension_id).trim();
    }
    if (!ext) {
      return res
        .status(400)
        .json({ error: "agentUserId or agentExtension is required" });
    }

    // Map mode → configured feature code. Never hardcoded; a blank/missing code
    // is a clean error, not a dial to a wrong extension (plan §10.5).
    const code = featureCodeForMode(mode);
    if (!code || !String(code).trim()) {
      return res.status(500).json({
        error: `Feature code for mode "${mode}" is not configured`,
      });
    }

    return res.json({
      dialString: `${String(code).trim()}${ext}`,
      mode,
      agentExtension: ext,
    });
  } catch (err) {
    console.error("Monitor target error:", err.message);
    return res
      .status(500)
      .json({ error: "Failed to build monitor target", detail: err.message });
  }
};

export const getRingGroupsList = async (req, res) => {
  try {
    const data = await getRingGroups();
    res.json(data);
  } catch (err) {
    console.error(
      "FreePBX ring groups error:",
      err.response?.data || err.message,
    );
    res.status(502).json({
      error: "Failed to fetch ring groups from FreePBX",
      detail: err.response?.data || err.message,
    });
  }
};
