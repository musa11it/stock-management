import { z } from 'zod';
import { paginationQuery } from './common';

const materialSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive('Must be greater than 0'),
  // Optional: defaults to the run's sourceWarehouseId if omitted (see production.service.ts) -
  // set it to pull this one material from a different warehouse instead.
  warehouseId: z.string().uuid().optional(),
});

export const createProductionSchema = z.object({
  body: z.object({
    finishedProductId: z.string().uuid('Select the product being produced'),
    plannedQuantity: z.coerce.number().positive('Must be greater than 0'),
    sourceWarehouseId: z.string().uuid('Select where the raw materials come from'),
    destinationWarehouseId: z.string().uuid().optional(),
    batchNumber: z.string().max(100).optional(),
    notes: z.string().max(1000).optional(),
    materials: z.array(materialSchema).min(1, 'Add at least one raw material').max(50),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const completeProductionSchema = z.object({
  body: z.object({
    actualQuantity: z.coerce.number().positive('Must be greater than 0').optional(),
  }),
  query: z.any().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listProductionsSchema = z.object({
  query: paginationQuery.extend({
    status: z.enum(['DRAFT', 'COMPLETED', 'CANCELLED']).optional(),
    finishedProductId: z.string().uuid().optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
});
