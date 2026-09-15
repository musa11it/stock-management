import { Prisma, RoleName, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { hashPassword } from '../utils/password';
import { resolvePagination, buildMeta } from '../utils/pagination';
import { writeAuditLog } from './auditLog.service';

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  status: true,
  managerId: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

export async function listUsers(query: { page?: number; limit?: number; search?: string; role?: RoleName; status?: UserStatus }) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.UserWhereInput = {
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.role ? { role: { name: query.role } } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: userSelect }),
    prisma.user.count({ where }),
  ]);

  return { data, meta: buildMeta(total, page, limit) };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!user) throw AppError.notFound('User not found');
  return user;
}

export async function createUser(
  input: { firstName: string; lastName: string; email: string; phone?: string; password: string; roleName: RoleName; managerId?: string | null },
  actorId: string,
) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw AppError.conflict('A user with this email already exists', 'EMAIL_TAKEN');

  const role = await prisma.role.findUnique({ where: { name: input.roleName } });
  if (!role) throw AppError.badRequest('Invalid role', 'INVALID_ROLE');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      passwordHash,
      roleId: role.id,
      managerId: input.managerId ?? null,
    },
    select: userSelect,
  });

  await writeAuditLog({ userId: actorId, action: 'USER_CREATED', entity: 'User', entityId: user.id, newValue: user });
  return user;
}

export async function updateUser(
  id: string,
  input: { firstName?: string; lastName?: string; phone?: string; roleName?: RoleName; status?: UserStatus; managerId?: string | null },
  actorId: string,
) {
  const existing = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!existing) throw AppError.notFound('User not found');

  if (existing.role.name === 'SUPER_ADMIN' && actorId !== existing.id) {
    throw AppError.forbidden('The super admin account cannot be modified by another user');
  }

  let roleId: string | undefined;
  if (input.roleName) {
    const role = await prisma.role.findUnique({ where: { name: input.roleName } });
    if (!role) throw AppError.badRequest('Invalid role', 'INVALID_ROLE');
    roleId = role.id;
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      status: input.status,
      managerId: input.managerId,
      ...(roleId ? { roleId } : {}),
    },
    select: userSelect,
  });

  await writeAuditLog({ userId: actorId, action: 'USER_UPDATED', entity: 'User', entityId: id, oldValue: existing, newValue: user });
  return user;
}

export async function deleteUser(id: string, actorId: string) {
  const existing = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!existing) throw AppError.notFound('User not found');
  if (existing.role.name === 'SUPER_ADMIN') {
    throw AppError.forbidden('The super admin account cannot be deleted');
  }
  if (id === actorId) {
    throw AppError.badRequest('You cannot delete your own account');
  }

  await prisma.user.update({ where: { id }, data: { status: 'INACTIVE' } });
  await writeAuditLog({ userId: actorId, action: 'USER_DELETED', entity: 'User', entityId: id, oldValue: existing });
}
