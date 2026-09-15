import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as menuItemService from '../services/menuItem.service';

export const publicMenu = asyncHandler(async (req: Request, res: Response) => {
  const items = await menuItemService.listPublicMenuItems({
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
  });
  sendSuccess(res, items, 'Menu fetched');
});
