import { Router } from 'express';
import {
  getAllUsers, getUserById, createUser, updateUser,
  deleteUser, getUserApiKey,
} from '../controllers/userController';

const router = Router();

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.get('/:id/api-key', getUserApiKey);

export default router;
