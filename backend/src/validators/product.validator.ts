import { z } from 'zod';
import { paginationQuery } from './common';

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(200),
    sku: z.string().min(1).max(40).optional(),
    barcode: z.string().max(64).optional(),
    description: z.string().max(2000).optional(),
    categoryId: z.string().uuid('Select a category'),
    unitId: z.string().uuid('Select a unit'),
    minimumStock: z.coerce.number().min(0).default(0),
    maximumStock: z.coerce.number().min(0).optional(),
    costPrice: z.coerce.number().min(0).default(0),
    sellingPrice: z.coerce.number().min(0).default(0),
    isPerishable: z.boolean().default(false),
    shelfLifeDays: z.coerce.number().int().min(0).max(3650).optional(),
  }).refine((v) => v.maximumStock === undefined || v.maximumStock >= v.minimumStock, {
    message: 'Maximum stock must be greater than or equal to minimum stock',
    path: ['maximumStock'],
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(200).optional(),
    sku: z.string().min(1).max(40).optional(),
    barcode: z.string().max(64).nullable().optional(),
    description: z.string().max(2000).optional(),
    categoryId: z.string().uuid('Select a category').optional(),
    unitId: z.string().uuid('Select a unit').optional(),
    minimumStock: z.coerce.number().min(0).optional(),
    maximumStock: z.coerce.number().min(0).optional(),
    costPrice: z.coerce.number().min(0).optional(),
    sellingPrice: z.coerce.number().min(0).optional(),
    isPerishable: z.boolean().optional(),
    shelfLifeDays: z.coerce.number().int().min(0).max(3650).optional(),
    isActive: z.boolean().optional(),
  }),
  query: z.any().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listProductsSchema = z.object({
  query: paginationQuery.extend({
    categoryId: z.string().uuid().optional(),
    lowStock: z.coerce.boolean().optional(),
    isActive: z.coerce.boolean().optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
});
