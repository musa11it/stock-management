import { prisma } from '../config/database';
import { getInventoryValue, getLowStockItems } from './inventory.service';
import { getSalesFinancials } from './reports.service';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
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

  const todayFinancials = await getSalesFinancials({ dateFrom: todayStart });

  return {
    todayProfit: {
      revenue: Math.round(todayFinancials.revenue * 100) / 100,
      cogs: Math.round(todayFinancials.cogs * 100) / 100,
      profit: Math.round(todayFinancials.profit * 100) / 100,
    },
    todayIngredientUsage: todayFinancials.ingredientUsage.slice(0, 8),
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
