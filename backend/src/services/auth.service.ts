import crypto from 'crypto';
import { prisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { comparePassword, hashPassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { writeAuditLog } from './auditLog.service';
import { ROLE_PERMISSIONS } from '../constants/permissions';
import { RoleName } from '@prisma/client';

function permissionsForRole(roleName: RoleName): string[] {
  if (roleName === 'SUPER_ADMIN') return ['*'];
  return ROLE_PERMISSIONS[roleName] ?? [];
}

async function issueTokens(user: { id: string; email: string; role: { name: RoleName } }) {
  const permissions = permissionsForRole(user.role.name);
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role.name, permissions });
  const refreshToken = signRefreshToken({ sub: user.id });
  return { accessToken, refreshToken, permissions };
}

export async function register(input: { firstName: string; lastName: string; email: string; phone?: string; password: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw AppError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  }

  const role = await prisma.role.findUnique({ where: { name: 'RETAIL_USER' } });
  if (!role) throw AppError.internal('Default role not configured. Run database seed.');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      passwordHash,
      roleId: role.id,
    },
    include: { role: true },
  });

  await writeAuditLog({ userId: user.id, action: 'USER_CREATED', entity: 'User', entityId: user.id, newValue: { email: user.email, role: role.name } });

  const tokens = await issueTokens(user);
  return { user, ...tokens };
}

export async function login(email: string, password: string, meta: { ipAddress?: string; userAgent?: string }) {
  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
  if (!user) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (user.status !== 'ACTIVE') {
    throw AppError.forbidden('This account is not active. Contact an administrator.', 'ACCOUNT_INACTIVE');
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAuditLog({
    userId: user.id,
    action: 'LOGIN',
    entity: 'User',
    entityId: user.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  const tokens = await issueTokens(user);
  return { user, ...tokens };
}

export async function refreshAccessToken(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw AppError.unauthorized('Invalid or expired refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { role: true } });
  if (!user || user.status !== 'ACTIVE') {
    throw AppError.unauthorized('Account not available');
  }

  return issueTokens(user);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User not found');

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw AppError.badRequest('Current password is incorrect', 'INVALID_PASSWORD');

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await writeAuditLog({ userId, action: 'PASSWORD_CHANGED', entity: 'User', entityId: userId });
}

export async function requestPasswordReset(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null; // do not leak account existence

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: token, passwordResetExpires: expires },
  });
  return token;
}

export async function resetPassword(token: string, newPassword: string) {
  const user = await prisma.user.findFirst({
    where: { passwordResetToken: token, passwordResetExpires: { gt: new Date() } },
  });
  if (!user) throw AppError.badRequest('Invalid or expired reset token', 'INVALID_RESET_TOKEN');

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
  });
  await writeAuditLog({ userId: user.id, action: 'PASSWORD_CHANGED', entity: 'User', entityId: user.id });
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  if (!user) throw AppError.notFound('User not found');
  return user;
}
