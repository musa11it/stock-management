import { z } from 'zod';
import { ProductType } from '@prisma/client';
import { paginationQuery } from './common';

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(200),
    description: z.string().max(2000).optional(),
    categoryId: z.string().uuid('Select a category'),
    unitId: z.string().uuid('Select a unit'),
    // Optional here (not just on update) so existing integrations/tests that don't send a type
    // keep working - the product simply stays unclassified until set from the product form.
    type: z.nativeEnum(ProductType).optional(),
    minimumStock: z.coerce.number().min(0).default(0),
    maximumStock: z.coerce.number().min(0).optional(),
    costPrice: z.coerce.number().min(0).default(0),
    // Optional: most ingredients aren't sold directly - only set this for the few that are.
    sellingPrice: z.coerce.number().min(0).optional(),
    isPerishable: z.boolean().default(false),
    // Required (and positive) only when isPerishable is true - enforced below via .refine().
    shelfLifeDays: z.coerce.number().int().positive('Shelf life must be a positive number of days').max(3650).optional(),
  })
    .refine((v) => v.maximumStock === undefined || v.maximumStock >= v.minimumStock, {
      message: 'Maximum stock must be greater than or equal to minimum stock',
      path: ['maximumStock'],
    })
    .refine((v) => !v.isPerishable || v.shelfLifeDays !== undefined, {
      message: 'Shelf life (days) is required for perishable products',
      path: ['shelfLifeDays'],
    }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(200).optional(),
    description: z.string().max(2000).optional(),
    categoryId: z.string().uuid('Select a category').optional(),
    unitId: z.string().uuid('Select a unit').optional(),
    type: z.nativeEnum(ProductType).nullable().optional(),
    minimumStock: z.coerce.number().min(0).optional(),
    maximumStock: z.coerce.number().min(0).optional(),
    costPrice: z.coerce.number().min(0).optional(),
    sellingPrice: z.coerce.number().min(0).nullable().optional(),
    isPerishable: z.boolean().optional(),
    // Positive-if-present here; whether it's *required* depends on the merged isPerishable
    // state (existing + this update), which product.service.ts enforces since it alone knows
    // the existing record.
    shelfLifeDays: z.coerce.number().int().positive('Shelf life must be a positive number of days').max(3650).optional(),
    isActive: z.boolean().optional(),
  }),
  query: z.any().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listProductsSchema = z.object({
  query: paginationQuery.extend({
    categoryId: z.string().uuid().optional(),
    type: z.nativeEnum(ProductType).optional(),
    lowStock: z.coerce.boolean().optional(),
    isActive: z.coerce.boolean().optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
});
