import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as productService from '../services/product.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await productService.listProducts(req.query as unknown as Parameters<typeof productService.listProducts>[0]);
  sendSuccess(res, data, 'Products fetched', 200, meta);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await productService.getProductById(req.params.id), 'Product fetched');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await productService.createProduct(req.body, req.user!.sub), 'Product created successfully', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await productService.updateProduct(req.params.id, req.body, req.user!.sub), 'Product updated successfully');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await productService.deleteProduct(req.params.id, req.user!.sub);
  sendSuccess(res, null, 'Product deleted successfully');
});
