import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as productionService from '../services/production.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await productionService.listProductions(
    req.query as unknown as Parameters<typeof productionService.listProductions>[0],
  );
  sendSuccess(res, data, 'Production runs fetched', 200, meta);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await productionService.getProductionById(req.params.id), 'Production run fetched');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await productionService.createProduction(req.body, req.user!.sub), 'Production run created', 201);
});

export const complete = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await productionService.completeProduction(req.params.id, req.body, req.user!.sub), 'Production completed and stock updated');
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await productionService.cancelProduction(req.params.id, req.user!.sub), 'Production run cancelled');
});
