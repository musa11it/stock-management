import { z } from 'zod';
import { paginationQuery } from './common';

export const createWarehouseSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(150),
    location: z.string().max(300).optional(),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const updateWarehouseSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(150).optional(),
    location: z.string().max(300).optional(),
    isActive: z.boolean().optional(),
  }),
  query: z.any().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listWarehousesSchema = z.object({
  query: paginationQuery,
  body: z.any().optional(),
  params: z.any().optional(),
});
