import { Router } from "express";
import { logAction } from "../services/auditLog";
import { User } from "../database/models";
import {
  getCallChart,
  exportCallChart,
  getCallRecordingsList,
  getRecordingFile,
  getRingGroupsList,
  getSipConfig,
  getMonitorTarget,
} from "../controllers/freepbxController";

const router = Router();

// Audit description for a monitor attempt: "<supervisor> started <mode> on ext
// <agentExt>". Reads the response body so successes carry the resolved
// extension; 403/failed attempts fall back to the request body (plan §9).
const monitorDescription = async (req, res, body) => {
  let mode = String(req.body?.mode || "spy").toLowerCase();
  let ext = req.body?.agentExtension || null;
  try {
    const parsed = typeof body === "string" ? JSON.parse(body) : body;
    if (parsed?.agentExtension) ext = parsed.agentExtension;
    if (parsed?.mode) mode = parsed.mode;
  } catch {
    // non-JSON body — keep request-derived values
  }
  const actor = await User.findByPk(req.user?.sub).catch(() => null);
  const who =
    actor?.full_name || req.user?.preferred_username || req.user?.sub || "unknown";
  return `${who} started ${mode} on ext ${ext || req.body?.agentUserId || "?"}`;
};

router.get("/sip-config", getSipConfig);
router.get("/calls/chart", getCallChart);
router.get(
  "/calls/chart/export",
  logAction({
    action: "export",
    targetType: "call_chart",
  }),
  exportCallChart,
);
router.get("/calls/recordings", getCallRecordingsList);
router.get("/recordings/file", getRecordingFile);
router.get("/ring-groups", getRingGroupsList);
router.post(
  "/monitor",
  logAction({
    action: "monitor_call",
    targetType: "call",
    description: monitorDescription,
  }),
  getMonitorTarget,
);

export default router;
