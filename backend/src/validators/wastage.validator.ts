import { z } from 'zod';
import { paginationQuery } from './common';

const wastageItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive('Must be greater than 0'),
});

export const createWastageSchema = z.object({
  body: z.object({
    warehouseId: z.string().uuid('Select a warehouse'),
    reason: z.enum(['EXPIRED', 'DAMAGED', 'SPOILED', 'BURNED', 'SPILLED', 'OTHER']),
    description: z.string().max(1000).optional(),
    items: z.array(wastageItemSchema).min(1, 'Add at least one item').max(100),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const reviewWastageSchema = z.object({
  body: z.object({
    approve: z.boolean(),
  }),
  query: z.any().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listWastageSchema = z.object({
  query: paginationQuery.extend({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    warehouseId: z.string().uuid().optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
});
