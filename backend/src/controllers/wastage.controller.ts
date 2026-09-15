import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as wastageService from '../services/wastage.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await wastageService.listWastage(req.query as unknown as Parameters<typeof wastageService.listWastage>[0]);
  sendSuccess(res, data, 'Wastage reports fetched', 200, meta);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await wastageService.getWastageById(req.params.id), 'Wastage report fetched');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const result = await wastageService.createWastage(req.body, req.user!.sub, req.user!.role);
  sendSuccess(res, result, 'Wastage report recorded successfully', 201);
});

export const review = asyncHandler(async (req: Request, res: Response) => {
  const result = await wastageService.reviewWastage(req.params.id, req.body.approve, req.user!.sub);
  sendSuccess(res, result, req.body.approve ? 'Wastage approved and stock updated' : 'Wastage rejected');
});
