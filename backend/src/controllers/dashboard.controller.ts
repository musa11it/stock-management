import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { getDashboardSummary, getNetProfitForPeriod, NET_PROFIT_PERIODS, type NetProfitPeriod } from '../services/dashboard.service';

export const summary = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await getDashboardSummary(), 'Dashboard summary fetched');
});

export const netProfitByPeriod = asyncHandler(async (req: Request, res: Response) => {
  const raw = typeof req.query.period === 'string' ? req.query.period.toUpperCase() : 'TODAY';
  const period = (NET_PROFIT_PERIODS as readonly string[]).includes(raw) ? (raw as NetProfitPeriod) : 'TODAY';
  sendSuccess(res, await getNetProfitForPeriod(period), 'Net profit fetched');
});
