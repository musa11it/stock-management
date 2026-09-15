import { z } from 'zod';

export const idParam = z.object({
  params: z.object({ id: z.string().uuid('Invalid id') }),
  body: z.any().optional(),
  query: z.any().optional(),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  search: z.string().max(200).optional(),
  sortBy: z.string().max(100).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === 'number' ? v.toString() : v))
  .refine((v) => !Number.isNaN(Number(v)), { message: 'Must be a valid number' });
