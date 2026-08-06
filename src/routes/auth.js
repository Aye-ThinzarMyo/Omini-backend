import { Router } from "express";
import { logoutUser } from "../controllers/authController";

const router = Router();

router.post("/logout", logoutUser);

export default router;
