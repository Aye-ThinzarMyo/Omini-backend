import { Router } from "express";
import {
  getCallChart,
  getCallRecordingsList,
  getRecordingFile,
<<<<<<< HEAD
  getRingGroupsList,
=======
  getSipConfig,
  getDepartments,
>>>>>>> d5747456ffb20ba1e893ac01a4e39befa27e2a72
} from "../controllers/freepbxController";

const router = Router();

router.get("/sip-config", getSipConfig);
router.get("/calls/chart", getCallChart);
router.get("/calls/recordings", getCallRecordingsList);
router.get("/recordings/file", getRecordingFile);
router.get("/ring-groups", getRingGroupsList);

export default router;
