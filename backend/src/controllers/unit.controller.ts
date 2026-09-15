import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as unitService from '../services/unit.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await unitService.listUnits(req.query as unknown as Parameters<typeof unitService.listUnits>[0]);
  sendSuccess(res, data, 'Units fetched', 200, meta);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await unitService.getUnitById(req.params.id), 'Unit fetched');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await unitService.createUnit(req.body, req.user!.sub), 'Unit created successfully', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await unitService.updateUnit(req.params.id, req.body, req.user!.sub), 'Unit updated successfully');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await unitService.deleteUnit(req.params.id, req.user!.sub);
  sendSuccess(res, null, 'Unit deleted successfully');
});
