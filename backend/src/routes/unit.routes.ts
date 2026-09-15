import { Router } from 'express';
import * as unitController from '../controllers/unit.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createUnitSchema, listUnitsSchema, updateUnitSchema } from '../validators/unit.validator';
import { idParam } from '../validators/common';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('units.read'), validate(listUnitsSchema), unitController.list);
router.get('/:id', requirePermission('units.read'), validate(idParam), unitController.getOne);
router.post('/', requirePermission('units.create'), validate(createUnitSchema), unitController.create);
router.patch('/:id', requirePermission('units.update'), validate(updateUnitSchema), unitController.update);
router.delete('/:id', requirePermission('units.delete'), validate(idParam), unitController.remove);

export default router;
