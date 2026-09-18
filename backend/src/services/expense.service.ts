import { Prisma, ExpenseCategory } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { resolvePagination, buildMeta } from '../utils/pagination';
import { writeAuditLog } from './auditLog.service';
import { generateDocNumber } from '../utils/docNumber';

const personSelect = { id: true, firstName: true, lastName: true, role: { select: { name: true } } } satisfies Prisma.UserSelect;

const expenseInclude = {
  createdBy: { select: personSelect },
  recipientUser: { select: personSelect },
} satisfies Prisma.ExpenseInclude;

export interface CreateExpenseInput {
  category: ExpenseCategory;
  recipientUserId?: string;
  recipientName?: string;
  amount: number;
  description?: string;
}

/** Created and paid in one step - there's no separate approval stage, so the creator is also the payer. */
export async function createExpense(input: CreateExpenseInput, actorId: string) {
  let recipientUserId: string | undefined;
  let recipientName: string | undefined;

  if (input.category === 'SALARY') {
    if (!input.recipientUserId) {
      throw AppError.badRequest('Select the staff or manager receiving this payment', 'RECIPIENT_REQUIRED');
    }
    const recipient = await prisma.user.findUnique({ where: { id: input.recipientUserId }, include: { role: true } });
    if (!recipient) throw AppError.badRequest('Selected recipient not found', 'INVALID_RECIPIENT');
    if (recipient.role.name !== 'STAFF' && recipient.role.name !== 'MANAGER') {
      throw AppError.badRequest('Salary payments can only be made to an existing staff or manager account', 'INVALID_RECIPIENT_ROLE');
    }
    recipientUserId = recipient.id;
  } else {
    const trimmed = input.recipientName?.trim();
    if (!trimmed) throw AppError.badRequest('Enter who or what this expense was paid to', 'RECIPIENT_NAME_REQUIRED');
    recipientName = trimmed;
  }

  const expense = await prisma.expense.create({
    data: {
      expenseNumber: generateDocNumber('EXP'),
      category: input.category,
      recipientUserId,
      recipientName,
      amount: input.amount,
      description: input.description,
      status: 'PAID',
      createdById: actorId,
    },
    include: expenseInclude,
  });

  await writeAuditLog({ userId: actorId, action: 'EXPENSE_CREATED', entity: 'Expense', entityId: expense.id, newValue: expense });
  return expense;
}

export async function listExpenses(query: {
  page?: number;
  limit?: number;
  category?: ExpenseCategory;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.ExpenseWhereInput = {
    ...(query.category ? { category: query.category } : {}),
    ...(query.dateFrom || query.dateTo
      ? { createdAt: { ...(query.dateFrom ? { gte: query.dateFrom } : {}), ...(query.dateTo ? { lte: query.dateTo } : {}) } }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.expense.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: expenseInclude }),
    prisma.expense.count({ where }),
  ]);
  return { data, meta: buildMeta(total, page, limit) };
}

export async function getExpenseById(id: string) {
  const expense = await prisma.expense.findUnique({ where: { id }, include: expenseInclude });
  if (!expense) throw AppError.notFound('Expense not found');
  return expense;
}

/** Self-service: a staff/manager viewing only the payments made out to them. */
export async function listMyExpenses(userId: string, query: { page?: number; limit?: number }) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.ExpenseWhereInput = { recipientUserId: userId };
  const [data, total] = await Promise.all([
    prisma.expense.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: expenseInclude }),
    prisma.expense.count({ where }),
  ]);
  return { data, meta: buildMeta(total, page, limit) };
}

export async function getExpenseForRecipient(id: string, userId: string) {
  const expense = await prisma.expense.findUnique({ where: { id }, include: expenseInclude });
  if (!expense || expense.recipientUserId !== userId) throw AppError.notFound('Payment not found');
  return expense;
}

/** Total of all PAID expenses in the range - the single figure Net Profit subtracts. Kept here, next to the data it sums, so reports.service.ts has one place to reuse rather than a second calculation. */
export async function getTotalPaidExpenses(range: { dateFrom?: Date; dateTo?: Date }): Promise<number> {
  const where: Prisma.ExpenseWhereInput = {
    status: 'PAID',
    ...(range.dateFrom || range.dateTo
      ? { createdAt: { ...(range.dateFrom ? { gte: range.dateFrom } : {}), ...(range.dateTo ? { lte: range.dateTo } : {}) } }
      : {}),
  };
  const result = await prisma.expense.aggregate({ where, _sum: { amount: true } });
  return result._sum.amount?.toNumber() ?? 0;
}
