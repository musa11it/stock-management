import { Router } from 'express';
import * as reportsController from '../controllers/reports.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';

const router = Router();
router.use(authenticate, requirePermission('reports.read'));

router.get('/stock', reportsController.stockReport);
router.get('/purchases', reportsController.purchasesReport);
router.get('/wastage', reportsController.wastageReport);
router.get('/sales', reportsController.salesReport);

export default router;
