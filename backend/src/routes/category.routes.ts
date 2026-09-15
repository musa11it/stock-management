import { Router } from 'express';
import * as categoryController from '../controllers/category.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createCategorySchema, listCategoriesSchema, updateCategorySchema } from '../validators/category.validator';
import { idParam } from '../validators/common';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('categories.read'), validate(listCategoriesSchema), categoryController.list);
router.get('/:id', requirePermission('categories.read'), validate(idParam), categoryController.getOne);
router.post('/', requirePermission('categories.create'), validate(createCategorySchema), categoryController.create);
router.patch('/:id', requirePermission('categories.update'), validate(updateCategorySchema), categoryController.update);
router.delete('/:id', requirePermission('categories.delete'), validate(idParam), categoryController.remove);

export default router;
