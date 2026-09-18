import { z } from 'zod';
import { paginationQuery } from './common';

export const adjustStockSchema = z.object({
  body: z.object({
    productId: z.string().uuid('Select a product'),
    warehouseId: z.string().uuid('Select a warehouse'),
    type: z.enum(['INCREASE', 'DECREASE']),
    quantity: z.coerce.number().positive('Must be greater than 0'),
    reason: z.string().min(1, 'Reason is required').max(300),
    notes: z.string().max(1000).optional(),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const consumeStockSchema = z.object({
  body: z.object({
    productId: z.string().uuid('Select a product'),
    warehouseId: z.string().uuid('Select a warehouse'),
    quantity: z.coerce.number().positive('Must be greater than 0'),
    reason: z.string().max(300).optional(),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const transferStockSchema = z.object({
  body: z
    .object({
      productId: z.string().uuid('Select a product'),
      fromWarehouseId: z.string().uuid('Select a source warehouse'),
      toWarehouseId: z.string().uuid('Select a destination warehouse'),
      quantity: z.coerce.number().positive('Must be greater than 0'),
      notes: z.string().max(1000).optional(),
    })
    .refine((v) => v.fromWarehouseId !== v.toWarehouseId, {
      message: 'Source and destination warehouses must be different',
      path: ['toWarehouseId'],
    }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const listStockMovementsSchema = z.object({
  query: paginationQuery.extend({
    productId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
    type: z.enum(['PURCHASE', 'CONSUMPTION', 'WASTAGE', 'SALE', 'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN']).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
});

export const listInventorySchema = z.object({
  query: paginationQuery.extend({
    warehouseId: z.string().uuid().optional(),
    lowStock: z.coerce.boolean().optional(),
    expiringSoon: z.coerce.boolean().optional(),
    expired: z.coerce.boolean().optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
});
