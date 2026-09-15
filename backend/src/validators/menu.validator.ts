import { z } from 'zod';
import { paginationQuery } from './common';

export const createMenuItemSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(150),
    description: z.string().max(1000).optional(),
    price: z.coerce.number().min(0, 'Cannot be negative'),
    category: z.string().max(100).optional(),
    imageUrl: z.string().max(2000).optional(),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const updateMenuItemSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(150).optional(),
    description: z.string().max(1000).optional(),
    price: z.coerce.number().min(0, 'Cannot be negative').optional(),
    category: z.string().max(100).optional(),
    imageUrl: z.string().max(2000).optional(),
    isActive: z.boolean().optional(),
  }),
  query: z.any().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listMenuItemsSchema = z.object({
  query: paginationQuery.extend({
    isActive: z.coerce.boolean().optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
});
