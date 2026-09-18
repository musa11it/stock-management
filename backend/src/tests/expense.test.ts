import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, createTestUser, uniqueSuffix } from './helpers';
import { createExpense, listMyExpenses, getExpenseForRecipient, getTotalPaidExpenses } from '../services/expense.service';
import { getNetProfit } from '../services/reports.service';

describe('expense management', () => {
  let managerId: string;
  let staffId: string;
  let otherStaffId: string;
  let customerId: string;
  const expenseIds: string[] = [];

  beforeAll(async () => {
    const manager = await createTestUser('MANAGER');
    const staff = await createTestUser('STAFF');
    const otherStaff = await createTestUser('STAFF');
    const customer = await createTestUser('RETAIL_USER');
    managerId = manager.id;
    staffId = staff.id;
    otherStaffId = otherStaff.id;
    customerId = customer.id;
  });

  afterAll(async () => {
    if (expenseIds.length > 0) {
      await prisma.expense.deleteMany({ where: { id: { in: expenseIds } } });
    }
    await prisma.auditLog.deleteMany({ where: { userId: { in: [managerId, staffId] }, entity: 'Expense' } });
    await prisma.user.deleteMany({ where: { id: { in: [managerId, staffId, otherStaffId, customerId] } } });
    await prisma.$disconnect();
  });

  it('pays a salary expense to an existing staff account and records who paid it', async () => {
    const expense = await createExpense({ category: 'SALARY', recipientUserId: staffId, amount: 300000 }, managerId);
    expenseIds.push(expense.id);

    expect(expense.status).toBe('PAID');
    expect(expense.recipientUserId).toBe(staffId);
    expect(expense.recipientUser?.role.name).toBe('STAFF');
    expect(expense.createdById).toBe(managerId);
    expect(expense.createdBy.role.name).toBe('MANAGER');
    expect(expense.amount.toNumber()).toBe(300000);

    const auditEntry = await prisma.auditLog.findFirst({ where: { entity: 'Expense', entityId: expense.id, action: 'EXPENSE_CREATED' } });
    expect(auditEntry).not.toBeNull();
    expect(auditEntry?.userId).toBe(managerId);
  });

  it('rejects a salary payment with no recipient selected', async () => {
    await expect(createExpense({ category: 'SALARY', amount: 100000 }, managerId)).rejects.toThrow(/select the staff or manager/i);
  });

  it('rejects a salary payment to a customer (RETAIL_USER) account', async () => {
    await expect(createExpense({ category: 'SALARY', recipientUserId: customerId, amount: 100000 }, managerId)).rejects.toThrow(
      /staff or manager account/i,
    );
  });

  it('records a non-salary expense with a free-text recipient/description', async () => {
    const expense = await createExpense(
      { category: 'ELECTRICITY', recipientName: 'City Power Co.', amount: 45000, description: `Monthly bill ${uniqueSuffix()}` },
      managerId,
    );
    expenseIds.push(expense.id);

    expect(expense.category).toBe('ELECTRICITY');
    expect(expense.recipientName).toBe('City Power Co.');
    expect(expense.recipientUserId).toBeNull();
  });

  it('rejects a non-salary expense with no recipient name/description', async () => {
    await expect(createExpense({ category: 'RENT', amount: 200000 }, managerId)).rejects.toThrow(/enter who or what/i);
  });

  it('lets the recipient see only their own payments, not everyone else\'s', async () => {
    const { data } = await listMyExpenses(staffId, {});
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((e) => e.recipientUserId === staffId)).toBe(true);

    const { data: otherData } = await listMyExpenses(otherStaffId, {});
    expect(otherData).toHaveLength(0);
  });

  it("blocks a staff member from viewing another staff member's payment receipt by id", async () => {
    const salaryExpense = await prisma.expense.findFirst({ where: { recipientUserId: staffId } });
    await expect(getExpenseForRecipient(salaryExpense!.id, otherStaffId)).rejects.toThrow(/not found/i);
    // The actual recipient can still see it.
    const own = await getExpenseForRecipient(salaryExpense!.id, staffId);
    expect(own.id).toBe(salaryExpense!.id);
  });

  it('is automatically deducted from Net Profit via the existing calculation, with no second profit logic', async () => {
    const before = await getTotalPaidExpenses({});
    const extra = await createExpense({ category: 'OTHER', recipientName: `Vendor ${uniqueSuffix()}`, amount: 12345 }, managerId);
    expenseIds.push(extra.id);
    const after = await getTotalPaidExpenses({});
    expect(after - before).toBe(12345);

    const netProfit = await getNetProfit({});
    expect(netProfit.expenseCost).toBeGreaterThanOrEqual(after);
    // netProfit must reflect the expense deduction using the exact same numbers reported.
    expect(netProfit.netProfit).toBeCloseTo(
      netProfit.grossProfit - netProfit.wastageCost - netProfit.consumptionCost - netProfit.adjustmentLossCost + netProfit.adjustmentGainValue - netProfit.expenseCost,
      2,
    );
  });
});
