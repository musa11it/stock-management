import { Router } from 'express';
import * as orderController from '../controllers/order.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createOrderSchema, listOrdersSchema } from '../validators/order.validator';
import { idParam } from '../validators/common';

// Customer-facing order endpoints - always scoped to the authenticated user's own orders.
const router = Router();
router.use(authenticate);

router.get('/', requirePermission('orders.read'), validate(listOrdersSchema), orderController.list);
router.get('/:id', requirePermission('orders.read'), validate(idParam), orderController.getOne);
router.post('/', requirePermission('orders.create'), validate(createOrderSchema), orderController.create);

export default router;
