import { Router } from 'express';
import {
  getAllUsers, getUserById, createUser, updateUser,
  deleteUser, getUserPermissions, updateUserPermissions, getUserApiKey,
} from '../controllers/userController';

const router = Router();

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.get('/:id/permissions', getUserPermissions);
router.put('/:id/permissions', updateUserPermissions);
router.get('/:id/api-key', getUserApiKey);

export default router;
