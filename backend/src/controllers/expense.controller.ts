import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import * as expenseService from '../services/expense.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await expenseService.listExpenses(req.query as unknown as Parameters<typeof expenseService.listExpenses>[0]);
  sendSuccess(res, data, 'Expenses fetched', 200, meta);
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await expenseService.getExpenseById(req.params.id), 'Expense fetched');
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await expenseService.createExpense(req.body, req.user!.sub), 'Expense recorded and paid successfully', 201);
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const { data, meta } = await expenseService.listMyExpenses(
    req.user!.sub,
    req.query as unknown as Parameters<typeof expenseService.listMyExpenses>[1],
  );
  sendSuccess(res, data, 'Payments fetched', 200, meta);
});

export const getMine = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await expenseService.getExpenseForRecipient(req.params.id, req.user!.sub), 'Payment fetched');
});
