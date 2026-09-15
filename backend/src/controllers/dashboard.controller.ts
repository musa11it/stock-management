import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { getDashboardSummary } from '../services/dashboard.service';

export const summary = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await getDashboardSummary(), 'Dashboard summary fetched');
});
