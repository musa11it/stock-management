import { z } from 'zod';
import { paginationQuery } from './common';

export const createSupplierSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(200),
    contactPerson: z.string().max(150).optional(),
    email: z.string().email('Enter a valid email').max(255).optional().or(z.literal('')),
    phone: z.string().max(30).optional(),
    address: z.string().max(500).optional(),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const updateSupplierSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(200).optional(),
    contactPerson: z.string().max(150).optional(),
    email: z.string().email('Enter a valid email').max(255).optional().or(z.literal('')),
    phone: z.string().max(30).optional(),
    address: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
  }),
  query: z.any().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listSuppliersSchema = z.object({
  query: paginationQuery,
  body: z.any().optional(),
  params: z.any().optional(),
});
