import { Router } from "express";
import { getCallChart, getCallRecordingsList, getRecordingFile } from "../controllers/freepbxController";

const router = Router();

router.get("/calls/chart", getCallChart);
router.get("/calls/recordings", getCallRecordingsList);
router.get("/recordings/file", getRecordingFile);

export default router;
