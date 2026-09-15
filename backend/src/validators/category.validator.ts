import { z } from 'zod';
import { paginationQuery } from './common';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100),
    description: z.string().max(1000).optional(),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100).optional(),
    description: z.string().max(1000).optional(),
    isActive: z.boolean().optional(),
  }),
  query: z.any().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listCategoriesSchema = z.object({
  query: paginationQuery,
  body: z.any().optional(),
  params: z.any().optional(),
});
