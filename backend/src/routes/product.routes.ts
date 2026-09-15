import { Router } from 'express';
import * as productController from '../controllers/product.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createProductSchema, listProductsSchema, updateProductSchema } from '../validators/product.validator';
import { idParam } from '../validators/common';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('products.read'), validate(listProductsSchema), productController.list);
router.get('/:id', requirePermission('products.read'), validate(idParam), productController.getOne);
router.post('/', requirePermission('products.create'), validate(createProductSchema), productController.create);
router.patch('/:id', requirePermission('products.update'), validate(updateProductSchema), productController.update);
router.delete('/:id', requirePermission('products.delete'), validate(idParam), productController.remove);

export default router;
