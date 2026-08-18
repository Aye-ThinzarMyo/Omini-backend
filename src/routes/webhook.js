import { Router } from "express";
import { chatbot } from "../controllers/webhookController";

const router = Router();

router.post("/chatbot", chatbot);

export default router;
