import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as saleService from '../services/sale.service';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const order = await saleService.createCustomerOrder(req.body, req.user!.sub);
  sendSuccess(res, order, 'Order placed successfully', 201);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await saleService.listOrdersForCustomer(
    req.user!.sub,
    req.query as unknown as Parameters<typeof saleService.listOrdersForCustomer>[1],
  );
  sendSuccess(res, data, 'Orders fetched', 200, meta);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const order = await saleService.getOrderForCustomer(req.params.id, req.user!.sub);
  sendSuccess(res, order, 'Order fetched');
});
