import { z } from 'zod';
import { paginationQuery } from './common';

export const createUnitSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(50),
    abbreviation: z.string().min(1, 'Abbreviation is required').max(10),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const updateUnitSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(50).optional(),
    abbreviation: z.string().min(1, 'Abbreviation is required').max(10).optional(),
  }),
  query: z.any().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listUnitsSchema = z.object({
  query: paginationQuery,
  body: z.any().optional(),
  params: z.any().optional(),
});
