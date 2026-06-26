import { Router } from 'express';
import { getAllPermissions, getMyPermissions, updateUserPermissions } from '../controllers/permissionController';

const router = Router();

router.get('/', getAllPermissions);
router.get('/my', getMyPermissions);
router.put('/:userId', updateUserPermissions);

export default router;
