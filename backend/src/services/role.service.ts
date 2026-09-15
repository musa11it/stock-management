import { prisma } from '../config/database';

export async function listRoles() {
  return prisma.role.findMany({
    include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function listPermissions() {
  return prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] });
}
