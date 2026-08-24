import { Router } from "express";
import { chatbot, chatwootWebhook } from "../controllers/webhookController";

const router = Router();

router.post("/chatbot", chatbot);
router.post("/chatwoot/events", chatwootWebhook);

export default router;
