import { Router } from "express";
import { getCallChart, getCallRecordingsList } from "../controllers/freepbxController";

const router = Router();

router.get("/calls/chart", getCallChart);
router.get("/calls/recordings", getCallRecordingsList);

export default router;
