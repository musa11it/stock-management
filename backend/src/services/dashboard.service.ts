import { prisma } from '../config/database';
import { getInventoryValue, getLowStockItems } from './inventory.service';
import { getNetProfit } from './reports.service';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(): Date {
  const d = startOfToday();
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

function startOfMonth(): Date {
  const d = startOfToday();
  d.setDate(1);
  return d;
}

function startOfYear(): Date {
  const d = startOfToday();
  d.setMonth(0, 1);
  return d;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const NET_PROFIT_PERIODS = ['TODAY', 'WEEK', 'MONTH', 'YEAR', 'ALL'] as const;
export type NetProfitPeriod = (typeof NET_PROFIT_PERIODS)[number];

/**
 * The Net Profit dashboard section, recomputed for whichever period the user picks -
 * still just getNetProfit() with a different `dateFrom`, so there's exactly one profit
 * calculation in the app regardless of period.
 */
export async function getNetProfitForPeriod(period: NetProfitPeriod) {
  const dateFrom: Date | undefined =
    period === 'TODAY'
      ? startOfToday()
      : period === 'WEEK'
        ? startOfWeek()
        : period === 'MONTH'
          ? startOfMonth()
          : period === 'YEAR'
            ? startOfYear()
            : undefined; // ALL time - no lower bound

  const financials = await getNetProfit({ dateFrom });

  return {
    period,
    periodStart: dateFrom ? dateFrom.toISOString() : null,
    revenue: round2(financials.revenue),
    cogs: round2(financials.cogs),
    grossProfit: round2(financials.grossProfit),
    wastageCost: round2(financials.wastageCost),
    consumptionCost: round2(financials.consumptionCost),
    adjustmentLossCost: round2(financials.adjustmentLossCost),
    adjustmentGainValue: round2(financials.adjustmentGainValue),
    expenseCost: round2(financials.expenseCost),
    netProfit: round2(financials.netProfit),
  };
}

export async function getDashboardSummary() {
  const todayStart = startOfToday();

  const [totalProducts, inventoryValue, lowStockItems, todayPurchases, todaySales, todayWastage, recentMovements] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    getInventoryValue(),
    getLowStockItems(),
    prisma.purchase.aggregate({
      where: { createdAt: { gte: todayStart } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.sale.aggregate({
      where: { createdAt: { gte: todayStart }, status: 'COMPLETED' },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.wastageItem.aggregate({
      where: { wastage: { createdAt: { gte: todayStart } } },
      _count: { _all: true },
      _sum: { quantity: true },
    }),
    prisma.stockMovement.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { product: { include: { unit: true } }, warehouse: true, createdBy: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const last7Days = await prisma.sale.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, status: 'COMPLETED' },
    select: { createdAt: true, total: true },
  });

  const salesByDay = new Map<string, number>();
  for (const sale of last7Days) {
    const key = sale.createdAt.toISOString().slice(0, 10);
    salesByDay.set(key, (salesByDay.get(key) ?? 0) + sale.total.toNumber());
  }

  // getNetProfit wraps getSalesFinancials, so today's revenue/cogs/profit are computed exactly
  // as before - only the extra loss breakdown (todayNetProfit) below is new.
  const todayFinancials = await getNetProfit({ dateFrom: todayStart });

  return {
    todayProfit: {
      revenue: Math.round(todayFinancials.revenue * 100) / 100,
      cogs: Math.round(todayFinancials.cogs * 100) / 100,
      profit: Math.round(todayFinancials.grossProfit * 100) / 100,
    },
    todayIngredientUsage: todayFinancials.ingredientUsage.slice(0, 8),
    todayNetProfit: {
      grossProfit: Math.round(todayFinancials.grossProfit * 100) / 100,
      wastageCost: Math.round(todayFinancials.wastageCost * 100) / 100,
      consumptionCost: Math.round(todayFinancials.consumptionCost * 100) / 100,
      adjustmentLossCost: Math.round(todayFinancials.adjustmentLossCost * 100) / 100,
      adjustmentGainValue: Math.round(todayFinancials.adjustmentGainValue * 100) / 100,
      expenseCost: Math.round(todayFinancials.expenseCost * 100) / 100,
      netProfit: Math.round(todayFinancials.netProfit * 100) / 100,
    },
    totalProducts,
    inventoryValue: Math.round(inventoryValue * 100) / 100,
    lowStockCount: lowStockItems.length,
    lowStockProducts: lowStockItems.slice(0, 10),
    todayPurchases: { count: todayPurchases._count._all, total: todayPurchases._sum.total?.toNumber() ?? 0 },
    todaySales: { count: todaySales._count._all, total: todaySales._sum.total?.toNumber() ?? 0 },
    todayWastage: { count: todayWastage._count._all, quantity: todayWastage._sum.quantity?.toNumber() ?? 0 },
    recentStockMovements: recentMovements,
    salesOverview: Array.from(salesByDay.entries()).map(([date, total]) => ({ date, total })),
  };
}
