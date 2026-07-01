import { Router } from 'express';
import { getAllAccountUsers } from '../controllers/accountController';

const router = Router();

router.get('/:accountId/users', getAllAccountUsers);

export default router;
