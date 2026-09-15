import { Router } from 'express';
import * as warehouseController from '../controllers/warehouse.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createWarehouseSchema, listWarehousesSchema, updateWarehouseSchema } from '../validators/warehouse.validator';
import { idParam } from '../validators/common';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('warehouses.read'), validate(listWarehousesSchema), warehouseController.list);
router.get('/:id', requirePermission('warehouses.read'), validate(idParam), warehouseController.getOne);
router.post('/', requirePermission('warehouses.create'), validate(createWarehouseSchema), warehouseController.create);
router.patch('/:id', requirePermission('warehouses.update'), validate(updateWarehouseSchema), warehouseController.update);
router.delete('/:id', requirePermission('warehouses.delete'), validate(idParam), warehouseController.remove);

export default router;
