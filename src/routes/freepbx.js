import { Router } from "express";
import { logAction } from "../services/auditLog";
import {
  getCallChart,
  exportCallChart,
  getCallRecordingsList,
  exportCallRecordings,
  getRecordingFile,
  getRingGroupsList,
  getSipConfig,
} from "../controllers/freepbxController";

const router = Router();

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
router.get(
  "/calls/recordings/export",
  logAction({
    action: "export",
    targetType: "call_recording",
  }),
  exportCallRecordings,
);
router.get("/recordings/file", getRecordingFile);
router.get("/ring-groups", getRingGroupsList);

export default router;
