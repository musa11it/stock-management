import { z } from 'zod';
import { paginationQuery } from './common';

const orderItemSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.coerce.number().int().positive('Must be greater than 0').max(100, 'Quantity is too high'),
});

export const createOrderSchema = z.object({
  body: z.object({
    paymentMethod: z.enum(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'OTHER']).default('CASH'),
    items: z.array(orderItemSchema).min(1, 'Add at least one item to your order').max(50, 'Too many items in one order'),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const listOrdersSchema = z.object({
  query: paginationQuery.extend({
    status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
});
