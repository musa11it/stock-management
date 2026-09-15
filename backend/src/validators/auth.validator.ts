import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const registerSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().min(1, 'Last name is required').max(100),
    email: z.string().email('Enter a valid email').max(255),
    phone: z.string().max(30).optional(),
    password: passwordSchema,
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Enter a valid email').max(255),
    password: z.string().min(1, 'Password is required').max(128),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Enter a valid email').max(255),
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    newPassword: passwordSchema,
  }),
  query: z.any().optional(),
  params: z.any().optional(),
});
