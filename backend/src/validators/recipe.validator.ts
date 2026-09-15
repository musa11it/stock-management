import { z } from 'zod';
import { paginationQuery } from './common';

const ingredientSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive('Must be greater than 0'),
});

function noDuplicateProducts(ingredients: { productId: string }[]) {
  return new Set(ingredients.map((i) => i.productId)).size === ingredients.length;
}

export const createRecipeSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(200),
    description: z.string().max(2000).optional(),
    menuItemId: z.string().uuid().optional(),
    ingredients: z.array(ingredientSchema).min(1, 'Add at least one ingredient').refine(noDuplicateProducts, {
      message: 'Each product can only appear once in a recipe',
    }),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const updateRecipeSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(200).optional(),
    description: z.string().max(2000).optional(),
    menuItemId: z.string().uuid().nullable().optional(),
    ingredients: z.array(ingredientSchema).min(1, 'Add at least one ingredient').refine(noDuplicateProducts, {
      message: 'Each product can only appear once in a recipe',
    }).optional(),
  }),
  query: z.any().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listRecipesSchema = z.object({
  query: paginationQuery,
  body: z.any().optional(),
  params: z.any().optional(),
});
