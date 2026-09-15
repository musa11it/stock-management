import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as stockService from '../services/stock.service';
import * as inventoryService from '../services/inventory.service';

export const adjust = asyncHandler(async (req: Request, res: Response) => {
  const result = await stockService.adjustStock({ ...req.body, userId: req.user!.sub });
  sendSuccess(res, result, 'Stock adjusted successfully', 201);
});

export const consume = asyncHandler(async (req: Request, res: Response) => {
  const result = await stockService.consumeStock({ ...req.body, userId: req.user!.sub });
  sendSuccess(res, result, 'Stock consumption recorded successfully', 201);
});

export const transfer = asyncHandler(async (req: Request, res: Response) => {
  const result = await stockService.transferStock({ ...req.body, userId: req.user!.sub });
  sendSuccess(res, result, 'Stock transferred successfully', 201);
});

export const listMovements = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await stockService.listStockMovements(req.query as unknown as Parameters<typeof stockService.listStockMovements>[0]);
  sendSuccess(res, data, 'Stock movements fetched', 200, meta);
});

export const listInventory = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await inventoryService.listInventory(req.query as unknown as Parameters<typeof inventoryService.listInventory>[0]);
  sendSuccess(res, data, 'Inventory fetched', 200, meta);
});
