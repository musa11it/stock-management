import { createCrudService } from '@/lib/crudService';
import type { Recipe, MenuItem } from '@/types';

export const recipeService = createCrudService<Recipe>('/recipes');
export const menuItemService = createCrudService<MenuItem>('/menu');
