import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as menuItemService from '../services/menuItem.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await menuItemService.listMenuItems(req.query as unknown as Parameters<typeof menuItemService.listMenuItems>[0]);
  sendSuccess(res, data, 'Menu items fetched', 200, meta);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await menuItemService.getMenuItemById(req.params.id), 'Menu item fetched');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await menuItemService.createMenuItem(req.body, req.user!.sub), 'Menu item created successfully', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await menuItemService.updateMenuItem(req.params.id, req.body, req.user!.sub), 'Menu item updated successfully');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await menuItemService.deleteMenuItem(req.params.id, req.user!.sub);
  sendSuccess(res, null, 'Menu item deleted successfully');
});
