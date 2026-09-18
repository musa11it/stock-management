import { z } from 'zod';
import { paginationQuery } from './common';

const saleItemSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.coerce.number().int().positive('Must be greater than 0'),
});

export const createSaleSchema = z.object({
  body: z.object({
    discount: z.coerce.number().min(0, 'Cannot be negative').default(0),
    tax: z.coerce.number().min(0, 'Cannot be negative').default(0),
    paymentMethod: z.enum(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'OTHER']).default('CASH'),
    customerName: z.string().max(150).optional(),
    items: z.array(saleItemSchema).min(1, 'Add at least one item').max(100),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const updateSaleStatusSchema = z.object({
  body: z.object({
    status: z.enum(['COMPLETED', 'CANCELLED']),
  }),
  query: z.any().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listSalesSchema = z.object({
  query: paginationQuery.extend({
    status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).optional(),
    warehouseId: z.string().uuid().optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
});
