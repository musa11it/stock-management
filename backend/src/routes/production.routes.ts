import { Router } from 'express';
import * as productionController from '../controllers/production.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createProductionSchema, completeProductionSchema, listProductionsSchema } from '../validators/production.validator';
import { idParam } from '../validators/common';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('production.read'), validate(listProductionsSchema), productionController.list);
router.get('/:id', requirePermission('production.read'), validate(idParam), productionController.getOne);
router.post('/', requirePermission('production.create'), validate(createProductionSchema), productionController.create);
router.post('/:id/complete', requirePermission('production.complete'), validate(completeProductionSchema), productionController.complete);
router.post('/:id/cancel', requirePermission('production.create'), validate(idParam), productionController.cancel);

export default router;
