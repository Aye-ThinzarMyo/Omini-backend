import { Router } from "express";
import {
  getCallChart,
  exportCallChart,
  getCallRecordingsList,
  getRecordingFile,
  getRingGroupsList,
  getSipConfig,
} from "../controllers/freepbxController";

const router = Router();

router.get("/sip-config", getSipConfig);
router.get("/calls/chart", getCallChart);
router.get("/calls/chart/export", exportCallChart);
router.get("/calls/recordings", getCallRecordingsList);
router.get("/recordings/file", getRecordingFile);
router.get("/ring-groups", getRingGroupsList);

export default router;
