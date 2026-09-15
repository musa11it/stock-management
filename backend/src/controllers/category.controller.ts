import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as categoryService from '../services/category.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await categoryService.listCategories(req.query as unknown as Parameters<typeof categoryService.listCategories>[0]);
  sendSuccess(res, data, 'Categories fetched', 200, meta);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await categoryService.getCategoryById(req.params.id), 'Category fetched');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await categoryService.createCategory(req.body, req.user!.sub), 'Category created successfully', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await categoryService.updateCategory(req.params.id, req.body, req.user!.sub), 'Category updated successfully');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await categoryService.deleteCategory(req.params.id, req.user!.sub);
  sendSuccess(res, null, 'Category deleted successfully');
});
