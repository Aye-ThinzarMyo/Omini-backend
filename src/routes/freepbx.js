import { Router } from "express";
import {
  getCallChart,
  getCallRecordingsList,
  getRecordingFile,
  getSipConfig,
  getDepartments,
} from "../controllers/freepbxController";

const router = Router();

router.get("/sip-config", getSipConfig);
router.get("/calls/chart", getCallChart);
router.get("/calls/recordings", getCallRecordingsList);
router.get("/recordings/file", getRecordingFile);

export default router;
