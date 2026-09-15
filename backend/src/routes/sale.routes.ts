import { Router } from 'express';
import * as saleController from '../controllers/sale.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createSaleSchema, listSalesSchema, updateSaleStatusSchema } from '../validators/sale.validator';
import { idParam } from '../validators/common';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('sales.read'), validate(listSalesSchema), saleController.list);
router.get('/:id', requirePermission('sales.read'), validate(idParam), saleController.getOne);
router.post('/', requirePermission('sales.create'), validate(createSaleSchema), saleController.create);
router.post('/:id/cancel', requirePermission('sales.update'), validate(idParam), saleController.cancel);
router.patch('/:id/status', requirePermission('sales.update'), validate(updateSaleStatusSchema), saleController.updateStatus);

export default router;
