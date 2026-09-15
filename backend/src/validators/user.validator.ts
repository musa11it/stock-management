import { z } from 'zod';
import { paginationQuery } from './common';

export const createUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().min(1, 'Last name is required').max(100),
    email: z.string().email('Enter a valid email').max(255),
    phone: z.string().max(30).optional(),
    password: z.string().min(8, 'At least 8 characters').max(128),
    roleName: z.enum(['SUPER_ADMIN', 'MANAGER', 'STAFF', 'RETAIL_USER']),
    managerId: z.string().uuid().optional().nullable(),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const updateUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required').max(100).optional(),
    lastName: z.string().min(1, 'Last name is required').max(100).optional(),
    phone: z.string().max(30).optional(),
    roleName: z.enum(['SUPER_ADMIN', 'MANAGER', 'STAFF', 'RETAIL_USER']).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    managerId: z.string().uuid().optional().nullable(),
  }),
  query: z.any().optional(),
  params: z.object({ id: z.string().uuid() }),
});

export const listUsersSchema = z.object({
  query: paginationQuery.extend({
    role: z.enum(['SUPER_ADMIN', 'MANAGER', 'STAFF', 'RETAIL_USER']).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  }),
  body: z.any().optional(),
  params: z.any().optional(),
});
