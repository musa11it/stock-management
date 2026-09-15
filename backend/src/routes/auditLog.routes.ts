import { Router } from 'express';
import * as auditLogController from '../controllers/auditLog.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('audit_logs.read'), auditLogController.list);

export default router;
