import { Router } from 'express';
import * as expenseController from '../controllers/expense.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createExpenseSchema, listExpensesSchema } from '../validators/expense.validator';
import { idParam } from '../validators/common';

const router = Router();
router.use(authenticate);

// Self-service receipt access: any authenticated staff/manager can see (only) the payments
// made out to them - registered before the generic "/:id" so "my" isn't swallowed as an id.
router.get('/my', expenseController.listMine);
router.get('/my/:id', validate(idParam), expenseController.getMine);

router.get('/', requirePermission('expenses.read'), validate(listExpensesSchema), expenseController.list);
router.get('/:id', requirePermission('expenses.read'), validate(idParam), expenseController.getOne);
router.post('/', requirePermission('expenses.create'), validate(createExpenseSchema), expenseController.create);

export default router;
