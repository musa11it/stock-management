import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';

const router = Router();
router.use(authenticate, requirePermission('reports.read'));

router.get('/', dashboardController.summary);
router.get('/net-profit', dashboardController.netProfitByPeriod);

export default router;
