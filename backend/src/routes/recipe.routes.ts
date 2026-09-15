import { Router } from 'express';
import * as recipeController from '../controllers/recipe.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createRecipeSchema, listRecipesSchema, updateRecipeSchema } from '../validators/recipe.validator';
import { idParam } from '../validators/common';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('recipes.read'), validate(listRecipesSchema), recipeController.list);
router.get('/:id', requirePermission('recipes.read'), validate(idParam), recipeController.getOne);
router.post('/', requirePermission('recipes.create'), validate(createRecipeSchema), recipeController.create);
router.patch('/:id', requirePermission('recipes.update'), validate(updateRecipeSchema), recipeController.update);
router.delete('/:id', requirePermission('recipes.delete'), validate(idParam), recipeController.remove);

export default router;
