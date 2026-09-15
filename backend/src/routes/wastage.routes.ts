import { Router } from 'express';
import * as wastageController from '../controllers/wastage.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createWastageSchema, listWastageSchema, reviewWastageSchema } from '../validators/wastage.validator';
import { idParam } from '../validators/common';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('wastage.read'), validate(listWastageSchema), wastageController.list);
router.get('/:id', requirePermission('wastage.read'), validate(idParam), wastageController.getOne);
router.post('/', requirePermission('wastage.create'), validate(createWastageSchema), wastageController.create);
router.post('/:id/review', requirePermission('wastage.approve'), validate(reviewWastageSchema), wastageController.review);

export default router;
