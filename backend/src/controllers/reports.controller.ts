import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as reportsService from '../services/reports.service';

function dateRange(req: Request) {
  return {
    dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
    dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
  };
}

export const stockReport = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await reportsService.getStockReport(), 'Stock report generated');
});

export const purchasesReport = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await reportsService.getPurchasesReport(dateRange(req)), 'Purchases report generated');
});

export const wastageReport = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await reportsService.getWastageReport(dateRange(req)), 'Wastage report generated');
});

export const salesReport = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await reportsService.getSalesReport(dateRange(req)), 'Sales report generated');
});
