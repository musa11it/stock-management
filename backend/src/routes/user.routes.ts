import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createUserSchema, listUsersSchema, updateUserSchema } from '../validators/user.validator';
import { idParam } from '../validators/common';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('users.read'), validate(listUsersSchema), userController.list);
router.get('/:id', requirePermission('users.read'), validate(idParam), userController.getOne);
router.post('/', requirePermission('users.create'), validate(createUserSchema), userController.create);
router.patch('/:id', requirePermission('users.update'), validate(updateUserSchema), userController.update);
router.delete('/:id', requirePermission('users.delete'), validate(idParam), userController.remove);

export default router;
