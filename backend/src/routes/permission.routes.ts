import { Router } from 'express';
import * as roleController from '../controllers/role.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('roles.read'), roleController.listPermissions);

export default router;
