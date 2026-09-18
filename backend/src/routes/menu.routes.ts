import { Router } from 'express';
import * as menuItemController from '../controllers/menuItem.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createMenuItemSchema, createMenuItemFromProductSchema, listMenuItemsSchema, updateMenuItemSchema } from '../validators/menu.validator';
import { idParam } from '../validators/common';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('menu.read'), validate(listMenuItemsSchema), menuItemController.list);
router.get('/:id', requirePermission('menu.read'), validate(idParam), menuItemController.getOne);
router.post('/', requirePermission('menu.create'), validate(createMenuItemSchema), menuItemController.create);
router.post('/from-product', requirePermission('menu.create'), validate(createMenuItemFromProductSchema), menuItemController.createFromProduct);
router.patch('/:id', requirePermission('menu.update'), validate(updateMenuItemSchema), menuItemController.update);
router.delete('/:id', requirePermission('menu.delete'), validate(idParam), menuItemController.remove);

export default router;
