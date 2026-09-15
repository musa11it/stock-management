import { Router } from 'express';
import * as supplierController from '../controllers/supplier.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createSupplierSchema, listSuppliersSchema, updateSupplierSchema } from '../validators/supplier.validator';
import { idParam } from '../validators/common';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('suppliers.read'), validate(listSuppliersSchema), supplierController.list);
router.get('/:id', requirePermission('suppliers.read'), validate(idParam), supplierController.getOne);
router.post('/', requirePermission('suppliers.create'), validate(createSupplierSchema), supplierController.create);
router.patch('/:id', requirePermission('suppliers.update'), validate(updateSupplierSchema), supplierController.update);
router.delete('/:id', requirePermission('suppliers.delete'), validate(idParam), supplierController.remove);

export default router;
