import { Router } from 'express';
import * as stockController from '../controllers/stock.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { listInventorySchema } from '../validators/stock.validator';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('stock.read'), validate(listInventorySchema), stockController.listInventory);

export default router;
