import { Router } from 'express';
import * as stockController from '../controllers/stock.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { adjustStockSchema, consumeStockSchema, transferStockSchema } from '../validators/stock.validator';

const router = Router();
router.use(authenticate);

router.post('/adjust', requirePermission('stock.adjust'), validate(adjustStockSchema), stockController.adjust);
router.post('/consume', requirePermission('stock.consume'), validate(consumeStockSchema), stockController.consume);
router.post('/transfer', requirePermission('stock.transfer'), validate(transferStockSchema), stockController.transfer);

export default router;
