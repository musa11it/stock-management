import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { resolvePagination, buildMeta } from '../utils/pagination';

type TxClient = Prisma.TransactionClient;

export interface AuditLogInput {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function writeAuditLog(input: AuditLogInput, client: TxClient | typeof prisma = prisma): Promise<void> {
  await client.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      oldValue: input.oldValue === undefined ? Prisma.JsonNull : (input.oldValue as Prisma.InputJsonValue),
      newValue: input.newValue === undefined ? Prisma.JsonNull : (input.newValue as Prisma.InputJsonValue),
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function listAuditLogs(query: { page?: number; limit?: number; userId?: string; entity?: string; action?: string }) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.AuditLogWhereInput = {
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.entity ? { entity: query.entity } : {}),
    ...(query.action ? { action: query.action } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { data, meta: buildMeta(total, page, limit) };
}
