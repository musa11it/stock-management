import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as supplierService from '../services/supplier.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await supplierService.listSuppliers(req.query as unknown as Parameters<typeof supplierService.listSuppliers>[0]);
  sendSuccess(res, data, 'Suppliers fetched', 200, meta);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await supplierService.getSupplierById(req.params.id), 'Supplier fetched');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await supplierService.createSupplier(req.body, req.user!.sub), 'Supplier created successfully', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await supplierService.updateSupplier(req.params.id, req.body, req.user!.sub), 'Supplier updated successfully');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await supplierService.deleteSupplier(req.params.id, req.user!.sub);
  sendSuccess(res, null, 'Supplier deleted successfully');
});
