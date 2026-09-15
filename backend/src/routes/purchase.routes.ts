import { Router } from 'express';
import * as purchaseController from '../controllers/purchase.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createPurchaseSchema,
  listPurchasesSchema,
  receivePurchaseSchema,
  updatePurchaseSchema,
} from '../validators/purchase.validator';
import { idParam } from '../validators/common';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('purchases.read'), validate(listPurchasesSchema), purchaseController.list);
router.get('/:id', requirePermission('purchases.read'), validate(idParam), purchaseController.getOne);
router.post('/', requirePermission('purchases.create'), validate(createPurchaseSchema), purchaseController.create);
router.patch('/:id', requirePermission('purchases.update'), validate(updatePurchaseSchema), purchaseController.update);
router.post('/:id/receive', requirePermission('purchases.receive'), validate(receivePurchaseSchema), purchaseController.receive);

export default router;
