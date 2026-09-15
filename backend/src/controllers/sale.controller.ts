import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as saleService from '../services/sale.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await saleService.listSales(req.query as unknown as Parameters<typeof saleService.listSales>[0]);
  sendSuccess(res, data, 'Sales fetched', 200, meta);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await saleService.getSaleById(req.params.id), 'Sale fetched');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await saleService.createSale(req.body, req.user!.sub), 'Sale recorded successfully', 201);
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await saleService.cancelSale(req.params.id, req.user!.sub), 'Sale cancelled and stock reversed');
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const sale = await saleService.updateSaleStatus(req.params.id, req.body.status, req.user!.sub);
  const message = req.body.status === 'CANCELLED' ? 'Order cancelled and stock reversed' : 'Order marked as fulfilled';
  sendSuccess(res, sale, message);
});
