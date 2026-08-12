import { Router } from "express";
import { chatwootWebhook } from "../controllers/webhookController";

const router = Router();

router.post("/chatwoot", chatwootWebhook);

export default router;
