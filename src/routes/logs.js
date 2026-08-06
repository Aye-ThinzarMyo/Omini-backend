import { Router } from "express";
import { getLogs } from "../controllers/logController";

const router = Router();

router.get("/", getLogs);

export default router;
