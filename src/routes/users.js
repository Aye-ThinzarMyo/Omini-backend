import { Router } from "express";
import { createUser, updateUser, deleteUser } from "../controllers/userController";

const router = Router();

router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;
