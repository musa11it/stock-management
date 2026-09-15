import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as warehouseService from '../services/warehouse.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await warehouseService.listWarehouses(req.query as unknown as Parameters<typeof warehouseService.listWarehouses>[0]);
  sendSuccess(res, data, 'Warehouses fetched', 200, meta);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await warehouseService.getWarehouseById(req.params.id), 'Warehouse fetched');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await warehouseService.createWarehouse(req.body, req.user!.sub), 'Warehouse created successfully', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await warehouseService.updateWarehouse(req.params.id, req.body, req.user!.sub), 'Warehouse updated successfully');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await warehouseService.deleteWarehouse(req.params.id, req.user!.sub);
  sendSuccess(res, null, 'Warehouse deactivated successfully');
});
