import { Router } from "express";
import { getCallChart } from "../controllers/freepbxController";

const router = Router();

router.get("/calls/chart", getCallChart);

export default router;
