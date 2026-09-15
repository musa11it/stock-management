import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { prisma, uniqueSuffix, ensureRole } from './helpers';
import { register, login, changePassword } from '../services/auth.service';
import { comparePassword, hashPassword } from '../utils/password';
import { signAccessToken, verifyAccessToken } from '../utils/jwt';
import { requirePermission } from '../middleware/authorize';
import { AppError } from '../errors/AppError';
import type { Request, Response } from 'express';

describe('password hashing', () => {
  it('never stores the plain-text password and verifies correctly', async () => {
    const hash = await hashPassword('Sup3rSecret!');
    expect(hash).not.toBe('Sup3rSecret!');
    expect(await comparePassword('Sup3rSecret!', hash)).toBe(true);
    expect(await comparePassword('WrongPassword', hash)).toBe(false);
  });
});

describe('jwt access tokens', () => {
  it('round-trips the payload including permissions', () => {
    const token = signAccessToken({ sub: 'user-1', email: 'a@b.com', role: 'MANAGER', permissions: ['products.read'] });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.permissions).toContain('products.read');
  });
});

describe('auth service', () => {
  let email: string;
  let userId: string;

  beforeAll(async () => {
    await ensureRole('RETAIL_USER');
  });

  afterAll(async () => {
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('registers a new retail user with a hashed password and RETAIL_USER role', async () => {
    email = `retail-${uniqueSuffix()}@example.com`;
    const result = await register({ firstName: 'New', lastName: 'Customer', email, password: 'Password@123' });
    userId = result.user.id;

    expect(result.user.passwordHash).not.toBe('Password@123');
    expect(result.accessToken).toBeTruthy();
    expect(result.permissions).toEqual(['orders.create', 'orders.read']);
  });

  it('rejects duplicate email registration', async () => {
    await expect(register({ firstName: 'Dup', lastName: 'User', email, password: 'Password@123' })).rejects.toThrow(/already exists/i);
  });

  it('rejects login with an incorrect password without revealing which field was wrong', async () => {
    await expect(login(email, 'WrongPassword1', {})).rejects.toThrow(/invalid email or password/i);
  });

  it('logs in successfully with correct credentials and issues a working access token', async () => {
    const result = await login(email, 'Password@123', {});
    const payload = verifyAccessToken(result.accessToken);
    expect(payload.email).toBe(email);
  });

  it('rejects changing the password when the current password is wrong', async () => {
    await expect(changePassword(userId, 'NotTheCurrentPassword', 'NewPassword@123')).rejects.toThrow(/incorrect/i);
  });

  it('changes the password successfully and the new password can log in', async () => {
    await changePassword(userId, 'Password@123', 'NewPassword@123');
    const result = await login(email, 'NewPassword@123', {});
    expect(result.user.id).toBe(userId);
  });
});

describe('requirePermission middleware', () => {
  function mockRes() {
    return {} as Response;
  }

  it('blocks a request missing the required permission', () => {
    const req = { user: { sub: 'u1', email: 'a@b.com', role: 'STAFF', permissions: ['menu.read'] } } as unknown as Request;
    const next = (err?: unknown) => {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(403);
    };
    requirePermission('users.delete')(req, mockRes(), next);
  });

  it('allows a request that has the required permission', () => {
    const req = { user: { sub: 'u1', email: 'a@b.com', role: 'MANAGER', permissions: ['products.read'] } } as unknown as Request;
    let called = false;
    const next = (err?: unknown) => {
      called = err === undefined;
    };
    requirePermission('products.read')(req, mockRes(), next);
    expect(called).toBe(true);
  });

  it('SUPER_ADMIN bypasses all permission checks via the wildcard', () => {
    const req = { user: { sub: 'u1', email: 'a@b.com', role: 'SUPER_ADMIN', permissions: ['*'] } } as unknown as Request;
    let called = false;
    const next = (err?: unknown) => {
      called = err === undefined;
    };
    requirePermission('settings.manage')(req, mockRes(), next);
    expect(called).toBe(true);
  });
});
