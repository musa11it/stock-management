import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as purchaseService from '../services/purchase.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await purchaseService.listPurchases(req.query as unknown as Parameters<typeof purchaseService.listPurchases>[0]);
  sendSuccess(res, data, 'Purchases fetched', 200, meta);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await purchaseService.getPurchaseById(req.params.id), 'Purchase fetched');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await purchaseService.createPurchase(req.body, req.user!.sub), 'Purchase created successfully', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await purchaseService.updatePurchase(req.params.id, req.body, req.user!.sub), 'Purchase updated successfully');
});

export const receive = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await purchaseService.receivePurchase(req.params.id, req.body, req.user!.sub), 'Purchase received and stock updated successfully');
});
