import { z } from 'zod';
import { paginationQuery } from './common';

const expenseCategories = [
  'SALARY',
  'ELECTRICITY',
  'WATER',
  'RENT',
  'TAX',
  'TRANSPORT',
  'MAINTENANCE',
  'INTERNET',
  'MARKETING',
  'OTHER',
] as const;

export const createExpenseSchema = z.object({
  body: z
    .object({
      category: z.enum(expenseCategories),
      recipientUserId: z.string().uuid().optional(),
      recipientName: z.string().max(200).optional(),
      amount: z.coerce.number().positive('Amount must be greater than 0'),
      description: z.string().max(1000).optional(),
    })
    .refine((v) => v.category !== 'SALARY' || !!v.recipientUserId, {
      message: 'Select the staff or manager receiving this payment',
      path: ['recipientUserId'],
    })
    .refine((v) => v.category === 'SALARY' || !!v.recipientName?.trim(), {
      message: 'Enter who or what this expense was paid to',
      path: ['recipientName'],
    }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const listExpensesSchema = z.object({
  query: paginationQuery.extend({
    category: z.enum(expenseCategories).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
});
