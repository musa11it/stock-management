import { prisma } from '../config/database';
import { getNearestExpiryMap } from './inventory.service';
import { getTotalPaidExpenses } from './expense.service';

export interface DateRangeQuery {
  dateFrom?: Date;
  dateTo?: Date;
}

export async function getStockReport() {
  const inventories = await prisma.inventory.findMany({
    include: { product: { include: { category: true, unit: true } }, warehouse: true },
    orderBy: { product: { name: 'asc' } },
  });

  const expiryMap = await getNearestExpiryMap(inventories.map((inv) => ({ productId: inv.productId, warehouseId: inv.warehouseId })));

  const rows = inventories.map((inv) => ({
    productId: inv.productId,
    productName: inv.product.name,
    category: inv.product.category.name,
    warehouse: inv.warehouse.name,
    unit: inv.product.unit.abbreviation,
    quantity: inv.quantity.toNumber(),
    minimumStock: inv.product.minimumStock.toNumber(),
    averageCost: inv.averageCost.toNumber(),
    value: inv.quantity.mul(inv.averageCost).toNumber(),
    isLowStock: inv.quantity.lessThanOrEqualTo(inv.product.minimumStock),
    expiryDate: expiryMap.get(`${inv.productId}:${inv.warehouseId}`)?.nearestExpiry ?? null,
    isExpired: expiryMap.get(`${inv.productId}:${inv.warehouseId}`)?.isExpired ?? false,
  }));

  return {
    rows,
    totalValue: rows.reduce((sum, r) => sum + r.value, 0),
    lowStockCount: rows.filter((r) => r.isLowStock).length,
  };
}

export async function getPurchasesReport(range: DateRangeQuery) {
  const purchases = await prisma.purchase.findMany({
    where: {
      ...(range.dateFrom || range.dateTo
        ? { purchaseDate: { ...(range.dateFrom ? { gte: range.dateFrom } : {}), ...(range.dateTo ? { lte: range.dateTo } : {}) } }
        : {}),
    },
    include: { supplier: true, items: true },
    orderBy: { purchaseDate: 'desc' },
  });

  const bySupplier = new Map<string, { supplierId: string; supplierName: string; count: number; total: number }>();
  for (const p of purchases) {
    const entry = bySupplier.get(p.supplierId) ?? { supplierId: p.supplierId, supplierName: p.supplier.name, count: 0, total: 0 };
    entry.count += 1;
    entry.total += p.total.toNumber();
    bySupplier.set(p.supplierId, entry);
  }

  return {
    purchases: purchases.map((p) => ({
      id: p.id,
      purchaseNumber: p.purchaseNumber,
      supplier: p.supplier.name,
      status: p.status,
      itemCount: p.items.length,
      total: p.total.toNumber(),
      purchaseDate: p.purchaseDate,
    })),
    totalSpend: purchases.reduce((sum, p) => sum + p.total.toNumber(), 0),
    bySupplier: Array.from(bySupplier.values()),
  };
}

export async function getWastageReport(range: DateRangeQuery) {
  const wastages = await prisma.wastage.findMany({
    where: {
      ...(range.dateFrom || range.dateTo
        ? { createdAt: { ...(range.dateFrom ? { gte: range.dateFrom } : {}), ...(range.dateTo ? { lte: range.dateTo } : {}) } }
        : {}),
    },
    include: { items: { include: { product: true } }, warehouse: true },
    orderBy: { createdAt: 'desc' },
  });

  const byReason = new Map<string, { reason: string; count: number; totalValue: number }>();
  let totalValue = 0;
  for (const w of wastages) {
    const wastageValue = w.items.reduce((sum, i) => sum + i.quantity.toNumber() * i.unitCost.toNumber(), 0);
    totalValue += wastageValue;
    const entry = byReason.get(w.reason) ?? { reason: w.reason, count: 0, totalValue: 0 };
    entry.count += 1;
    entry.totalValue += wastageValue;
    byReason.set(w.reason, entry);
  }

  return {
    wastages: wastages.map((w) => ({
      id: w.id,
      wastageNumber: w.wastageNumber,
      warehouse: w.warehouse.name,
      reason: w.reason,
      status: w.status,
      itemCount: w.items.length,
      createdAt: w.createdAt,
    })),
    totalValue,
    byReason: Array.from(byReason.values()),
  };
}

export async function getSalesReport(range: DateRangeQuery) {
  const sales = await prisma.sale.findMany({
    where: {
      status: 'COMPLETED',
      ...(range.dateFrom || range.dateTo
        ? { createdAt: { ...(range.dateFrom ? { gte: range.dateFrom } : {}), ...(range.dateTo ? { lte: range.dateTo } : {}) } }
        : {}),
    },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  const byPaymentMethod = new Map<string, { method: string; count: number; total: number }>();
  for (const s of sales) {
    const entry = byPaymentMethod.get(s.paymentMethod) ?? { method: s.paymentMethod, count: 0, total: 0 };
    entry.count += 1;
    entry.total += s.total.toNumber();
    byPaymentMethod.set(s.paymentMethod, entry);
  }

  const financials = await getSalesFinancials(range);

  return {
    sales: sales.map((s) => ({
      id: s.id,
      saleNumber: s.saleNumber,
      itemCount: s.items.length,
      total: s.total.toNumber(),
      paymentMethod: s.paymentMethod,
      createdAt: s.createdAt,
    })),
    totalRevenue: sales.reduce((sum, s) => sum + s.total.toNumber(), 0),
    byPaymentMethod: Array.from(byPaymentMethod.values()),
    cogs: financials.cogs,
    profit: financials.profit,
    ingredientUsage: financials.ingredientUsage,
  };
}

export interface IngredientUsageRow {
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  cost: number;
}

/**
 * Revenue from completed orders/sales, minus the cost of the ingredients those orders consumed
 * (valued at each ingredient's current cost price) - i.e. profit, plus a breakdown of what was
 * actually used to earn it.
 */
export async function getSalesFinancials(range: DateRangeQuery) {
  const sales = await prisma.sale.findMany({
    where: {
      status: 'COMPLETED',
      ...(range.dateFrom || range.dateTo
        ? { createdAt: { ...(range.dateFrom ? { gte: range.dateFrom } : {}), ...(range.dateTo ? { lte: range.dateTo } : {}) } }
        : {}),
    },
    include: {
      items: {
        include: {
          menuItem: {
            include: { recipe: { include: { ingredients: { include: { product: { include: { unit: true } } } } } } },
          },
        },
      },
    },
  });

  let revenue = 0;
  let cogs = 0;
  const usageByProduct = new Map<string, IngredientUsageRow>();

  for (const sale of sales) {
    revenue += sale.total.toNumber();
    for (const item of sale.items) {
      const recipe = item.menuItem.recipe;
      if (!recipe) continue;
      for (const ingredient of recipe.ingredients) {
        const quantity = ingredient.quantity.toNumber() * item.quantity;
        const cost = quantity * ingredient.product.costPrice.toNumber();
        cogs += cost;

        const existing = usageByProduct.get(ingredient.productId);
        if (existing) {
          existing.quantity += quantity;
          existing.cost += cost;
        } else {
          usageByProduct.set(ingredient.productId, {
            productId: ingredient.productId,
            productName: ingredient.product.name,
            unit: ingredient.product.unit.abbreviation,
            quantity,
            cost,
          });
        }
      }
    }
  }

  return {
    revenue,
    cogs,
    profit: revenue - cogs,
    ingredientUsage: Array.from(usageByProduct.values()).sort((a, b) => b.cost - a.cost),
  };
}

export interface NetProfitBreakdown {
  revenue: number;
  cogs: number;
  grossProfit: number;
  wastageCost: number;
  consumptionCost: number;
  /** StockAdjustment DECREASE (e.g. stock count came up short) - a loss, subtracted. */
  adjustmentLossCost: number;
  /** StockAdjustment INCREASE (e.g. stock count came up over) - a gain, added. */
  adjustmentGainValue: number;
  /** Every PAID Expense (salaries, rent, utilities, ...) recorded via the Expense module - a loss, subtracted. */
  expenseCost: number;
  netProfit: number;
  ingredientUsage: IngredientUsageRow[];
}

/**
 * Net profit = gross profit from sales (getSalesFinancials) minus every other existing loss
 * record the system already tracks - approved wastage, internal consumption, and DECREASE
 * stock adjustments - plus INCREASE stock adjustments (found/corrected stock), which add back.
 * All valued at Product.costPrice, the same cost basis already used for COGS and for
 * wastage/consumption stock movements elsewhere in the app - nothing here introduces a second
 * source of truth for cost.
 */
export async function getNetProfit(range: DateRangeQuery): Promise<NetProfitBreakdown> {
  const financials = await getSalesFinancials(range);

  const dateFilter =
    range.dateFrom || range.dateTo
      ? { createdAt: { ...(range.dateFrom ? { gte: range.dateFrom } : {}), ...(range.dateTo ? { lte: range.dateTo } : {}) } }
      : {};

  const [wastageItems, consumptionMovements, adjustments, expenseCost] = await Promise.all([
    prisma.wastageItem.findMany({
      where: { wastage: { status: 'APPROVED', ...dateFilter } },
      include: { product: { select: { costPrice: true } } },
    }),
    prisma.stockMovement.findMany({
      where: { type: 'CONSUMPTION', ...dateFilter },
      include: { product: { select: { costPrice: true } } },
    }),
    prisma.stockAdjustment.findMany({
      where: { ...dateFilter },
      include: { product: { select: { costPrice: true } } },
    }),
    getTotalPaidExpenses(range),
  ]);

  const wastageCost = wastageItems.reduce((sum, i) => sum + i.quantity.toNumber() * i.product.costPrice.toNumber(), 0);
  const consumptionCost = consumptionMovements.reduce(
    (sum, m) => sum + Math.abs(m.quantity.toNumber()) * m.product.costPrice.toNumber(),
    0,
  );
  const adjustmentLossCost = adjustments
    .filter((a) => a.type === 'DECREASE')
    .reduce((sum, a) => sum + a.quantity.toNumber() * a.product.costPrice.toNumber(), 0);
  const adjustmentGainValue = adjustments
    .filter((a) => a.type === 'INCREASE')
    .reduce((sum, a) => sum + a.quantity.toNumber() * a.product.costPrice.toNumber(), 0);

  return {
    revenue: financials.revenue,
    cogs: financials.cogs,
    grossProfit: financials.profit,
    wastageCost,
    consumptionCost,
    adjustmentLossCost,
    adjustmentGainValue,
    expenseCost,
    netProfit: financials.profit - wastageCost - consumptionCost - adjustmentLossCost + adjustmentGainValue - expenseCost,
    ingredientUsage: financials.ingredientUsage,
  };
}
