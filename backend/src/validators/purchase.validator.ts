import { z } from 'zod';
import { paginationQuery } from './common';

const purchaseItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive('Must be greater than 0'),
  unitCost: z.coerce.number().min(0, 'Cannot be negative'),
  batchNumber: z.string().max(100).optional(),
});

export const createPurchaseSchema = z.object({
  body: z.object({
    supplierId: z.string().uuid('Select a supplier'),
    warehouseId: z.string().uuid('Select a warehouse'),
    invoiceNumber: z.string().max(100).optional(),
    purchaseDate: z.coerce.date().optional(),
    tax: z.coerce.number().min(0, 'Cannot be negative').default(0),
    discount: z.coerce.number().min(0, 'Cannot be negative').default(0),
    notes: z.string().max(1000).optional(),
    items: z.array(purchaseItemSchema).min(1, 'At least one item is required').max(200),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const updatePurchaseSchema = z.object({
  body: z.object({
    supplierId: z.string().uuid().optional(),
    invoiceNumber: z.string().max(100).optional(),
    purchaseDate: z.coerce.date().optional(),
    tax: z.coerce.number().min(0, 'Cannot be negative').optional(),
    discount: z.coerce.number().min(0, 'Cannot be negative').optional(),
    notes: z.string().max(1000).optional(),
    status: z.enum(['DRAFT', 'PENDING', 'CANCELLED']).optional(),
    items: z.array(purchaseItemSchema).min(1).max(200).optional(),
  }),
  query: z.any().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const receivePurchaseSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          receivedQty: z.coerce.number().positive('Must be greater than 0'),
        }),
      )
      .max(200)
      .optional(),
  }),
  query: z.any().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listPurchasesSchema = z.object({
  query: paginationQuery.extend({
    status: z.enum(['DRAFT', 'PENDING', 'RECEIVED', 'PARTIALLY_RECEIVED', 'CANCELLED']).optional(),
    supplierId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
});
