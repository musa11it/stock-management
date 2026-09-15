import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as recipeService from '../services/recipe.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await recipeService.listRecipes(req.query as unknown as Parameters<typeof recipeService.listRecipes>[0]);
  sendSuccess(res, data, 'Recipes fetched', 200, meta);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await recipeService.getRecipeById(req.params.id), 'Recipe fetched');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await recipeService.createRecipe(req.body, req.user!.sub), 'Recipe created successfully', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await recipeService.updateRecipe(req.params.id, req.body, req.user!.sub), 'Recipe updated successfully');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await recipeService.deleteRecipe(req.params.id, req.user!.sub);
  sendSuccess(res, null, 'Recipe deleted successfully');
});
