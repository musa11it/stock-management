import { Prisma, ProductionStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { resolvePagination, buildMeta } from '../utils/pagination';
import { writeAuditLog } from './auditLog.service';
import { applyStockMovement, assertProductWarehouseAssignment } from './inventory.service';
import { generateDocNumber } from '../utils/docNumber';
import { getFinishedGoodsWarehouseId } from './warehouse.service';

const productionInclude = {
  // directSaleMenuItem lets the Production page show "List for Sale" vs "Listed for sale" for
  // the finished product without a second request.
  finishedProduct: { include: { unit: true, directSaleMenuItem: { select: { id: true } } } },
  sourceWarehouse: true,
  destinationWarehouse: true,
  createdBy: { select: { id: true, firstName: true, lastName: true, role: { select: { name: true } } } },
  materials: { include: { product: { include: { unit: true } }, warehouse: true } },
} satisfies Prisma.ProductionInclude;

export interface ProductionMaterialInput {
  productId: string;
  quantity: number;
  /** Defaults to sourceWarehouseId if omitted - set to pull this one material from a different warehouse. */
  warehouseId?: string;
}

export interface CreateProductionInput {
  finishedProductId: string;
  plannedQuantity: number;
  sourceWarehouseId: string;
  /** Defaults to Finished Goods Store - the user is never required to pick this every time.
   *  Still overridable for a business that genuinely wants a different destination. */
  destinationWarehouseId?: string;
  batchNumber?: string;
  notes?: string;
  materials: ProductionMaterialInput[];
}

/**
 * Plan a production run: raw materials + planned output. Nothing touches stock yet - a
 * Production stays DRAFT (mirroring how a Purchase stays PENDING) until completeProduction()
 * confirms it with the actual yield.
 */
export async function createProduction(input: CreateProductionInput, actorId: string) {
  // Finished output goes to Finished Goods Store by default - never automatically back into the
  // raw-material warehouse it was produced from. This is also the one warehouse Sales fulfills
  // from (see warehouse.service.ts), so a produced item is immediately sellable with no extra
  // manual transfer step.
  const destinationWarehouseId = input.destinationWarehouseId ?? (await getFinishedGoodsWarehouseId(prisma));

  if (input.materials.length === 0) {
    throw AppError.badRequest('Add at least one raw material', 'MATERIALS_REQUIRED');
  }
  if (new Set(input.materials.map((m) => m.productId)).size !== input.materials.length) {
    throw AppError.badRequest('Each raw material can only appear once', 'DUPLICATE_MATERIAL');
  }
  if (input.materials.some((m) => m.productId === input.finishedProductId)) {
    throw AppError.badRequest('The finished product cannot also be listed as a raw material', 'INVALID_MATERIAL');
  }

  const productIds = [input.finishedProductId, ...input.materials.map((m) => m.productId)];
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  if (products.length !== new Set(productIds).size) {
    throw AppError.badRequest('One or more products are invalid', 'INVALID_PRODUCT');
  }
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Type is nullable (see schema.prisma) so a product created before this classification
  // existed - `type === null` - is still allowed through everywhere, exactly as it worked
  // before this feature. Once a product IS classified, it must be used consistently.
  const finishedProduct = productMap.get(input.finishedProductId)!;
  if (finishedProduct.type && finishedProduct.type !== 'FINISHED_PRODUCT') {
    throw AppError.badRequest(
      `"${finishedProduct.name}" is classified as ${finishedProduct.type.replace('_', ' ').toLowerCase()}, not a finished product`,
      'INVALID_FINISHED_PRODUCT_TYPE',
    );
  }
  for (const material of input.materials) {
    const product = productMap.get(material.productId)!;
    if (product.type && product.type !== 'RAW_MATERIAL') {
      throw AppError.badRequest(
        `"${product.name}" is classified as ${product.type.replace('_', ' ').toLowerCase()}, not a raw material`,
        'INVALID_RAW_MATERIAL_TYPE',
      );
    }
  }

  // Each material can be pulled from its own warehouse (e.g. Flour from Main Kitchen Store,
  // Sugar from Cold Room in the same run) - defaults to sourceWarehouseId when not overridden,
  // so a single-warehouse business never has to think about this. Raw materials must already be
  // stocked in whichever warehouse they're resolved to - same assignment rule already enforced
  // for consumption/wastage/decrease-adjustments everywhere else.
  const materialWarehouseIds = input.materials.map((m) => m.warehouseId ?? input.sourceWarehouseId);
  for (let i = 0; i < input.materials.length; i++) {
    await assertProductWarehouseAssignment(prisma, input.materials[i].productId, materialWarehouseIds[i], false);
  }
  // The finished product can be brand new to the destination warehouse (that's how it gets its
  // first assignment there), but not already assigned exclusively to a different warehouse -
  // same bootstrap-permitting rule purchases and stock increases already follow.
  await assertProductWarehouseAssignment(prisma, input.finishedProductId, destinationWarehouseId, true);

  const materialsData = input.materials.map((m, i) => {
    const product = productMap.get(m.productId)!;
    const unitCost = product.costPrice.toNumber();
    return { productId: m.productId, warehouseId: materialWarehouseIds[i], quantity: m.quantity, unitCost, total: unitCost * m.quantity };
  });

  const production = await prisma.production.create({
    data: {
      productionNumber: generateDocNumber('PRD'),
      finishedProductId: input.finishedProductId,
      plannedQuantity: input.plannedQuantity,
      sourceWarehouseId: input.sourceWarehouseId,
      destinationWarehouseId,
      batchNumber: input.batchNumber,
      notes: input.notes,
      createdById: actorId,
      status: 'DRAFT',
      materials: { create: materialsData },
    },
    include: productionInclude,
  });

  await writeAuditLog({ userId: actorId, action: 'PRODUCTION_CREATED', entity: 'Production', entityId: production.id, newValue: production });
  return production;
}

export interface CompleteProductionInput {
  /** What actually came out. Defaults to plannedQuantity when the run went exactly to plan; a
   *  lower number is production loss/wastage - no separate record needed, it's just never
   *  inventoried, so it never enters COGS or any other cost either. */
  actualQuantity?: number;
}

export async function completeProduction(id: string, input: CompleteProductionInput, actorId: string) {
  return prisma.$transaction(async (tx) => {
    // Row-lock this production run before reading its status, so two near-simultaneous
    // "Complete" requests can't both pass the DRAFT check and both create stock movements -
    // the second waits here until the first's transaction commits, then correctly sees COMPLETED.
    await tx.$executeRaw`SELECT id FROM productions WHERE id = ${id} FOR UPDATE`;
    const production = await tx.production.findUnique({ where: { id }, include: { materials: true, finishedProduct: true } });
    if (!production) throw AppError.notFound('Production not found');
    if (production.status !== 'DRAFT') {
      throw AppError.conflict(`Cannot complete a ${production.status.toLowerCase()} production run`, 'INVALID_PRODUCTION_STATUS');
    }

    const actualQuantity = input.actualQuantity ?? production.plannedQuantity.toNumber();
    if (actualQuantity <= 0) throw AppError.badRequest('Actual quantity must be greater than 0', 'INVALID_QUANTITY');

    // Consume each raw material out of its own resolved warehouse (falls back to
    // sourceWarehouseId for a material row created before per-material warehouses existed).
    for (const material of production.materials) {
      await applyStockMovement(tx, {
        productId: material.productId,
        warehouseId: material.warehouseId ?? production.sourceWarehouseId,
        type: 'PRODUCTION_CONSUME',
        signedQuantity: -material.quantity.toNumber(),
        unitCost: material.unitCost.toNumber(),
        referenceType: 'PRODUCTION',
        referenceId: production.id,
        reason: `Production ${production.productionNumber}`,
        createdById: actorId,
      });
    }

    // The finished product's cost is exactly what the raw materials cost, spread over whatever
    // actually came out - reuses the same weighted-average blending every purchase/transfer
    // already goes through, no separate costing formula.
    const totalCost = production.materials.reduce((sum, m) => sum + m.total.toNumber(), 0);
    const unitCost = totalCost / actualQuantity;

    const completedAt = new Date();
    // Same rule as receiving a purchase: Expiry Date = Received (here: produced) Date + Shelf Life.
    const expiryDate =
      production.finishedProduct.isPerishable && production.finishedProduct.shelfLifeDays
        ? new Date(completedAt.getTime() + production.finishedProduct.shelfLifeDays * 24 * 60 * 60 * 1000)
        : undefined;

    await applyStockMovement(tx, {
      productId: production.finishedProductId,
      warehouseId: production.destinationWarehouseId,
      type: 'PRODUCTION_YIELD',
      signedQuantity: actualQuantity,
      unitCost,
      referenceType: 'PRODUCTION',
      referenceId: production.id,
      reason: `Production ${production.productionNumber}`,
      createdById: actorId,
      expiryDate,
      // No manual batch-number entry on the form anymore - the production run's own number
      // (already unique, e.g. "PRD-000123") IS the batch/lot code, so every yield stays
      // traceable without asking the user to type anything.
      batchNumber: production.batchNumber ?? production.productionNumber,
    });

    // Product.costPrice is what every other costing path (Sale COGS, wastage, adjustments -
    // see reports.service.ts / sale.service.ts) actually reads; Inventory.averageCost is a
    // separate weighted-average used for stock valuation. A produced item is never "purchased"
    // so its costPrice would otherwise sit stale at whatever placeholder it had (often 0),
    // silently understating COGS on every sale. Settling it here, to the real cost this batch
    // was just produced at, keeps that one shared costing path accurate for produced goods too -
    // no separate COGS formula, no changes to sale.service.ts or reports.service.ts.
    await tx.product.update({ where: { id: production.finishedProductId }, data: { costPrice: unitCost } });

    const updated = await tx.production.update({
      where: { id },
      data: { status: 'COMPLETED', actualQuantity, unitCost, totalCost, completedAt },
      include: productionInclude,
    });

    await writeAuditLog(
      { userId: actorId, action: 'PRODUCTION_COMPLETED', entity: 'Production', entityId: id, newValue: updated },
      tx,
    );
    return updated;
  });
}

/** A draft never touched stock, so cancelling it is just a status change - nothing to reverse. */
export async function cancelProduction(id: string, actorId: string) {
  const existing = await getProductionById(id);
  if (existing.status !== 'DRAFT') {
    throw AppError.conflict('Only a draft production run can be cancelled', 'INVALID_PRODUCTION_STATUS');
  }
  const updated = await prisma.production.update({ where: { id }, data: { status: 'CANCELLED' }, include: productionInclude });
  await writeAuditLog({ userId: actorId, action: 'PRODUCTION_CANCELLED', entity: 'Production', entityId: id, oldValue: existing, newValue: updated });
  return updated;
}

export async function listProductions(query: {
  page?: number;
  limit?: number;
  status?: ProductionStatus;
  finishedProductId?: string;
}) {
  const { skip, take, page, limit } = resolvePagination(query);
  const where: Prisma.ProductionWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.finishedProductId ? { finishedProductId: query.finishedProductId } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.production.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: productionInclude }),
    prisma.production.count({ where }),
  ]);
  return { data, meta: buildMeta(total, page, limit) };
}

export async function getProductionById(id: string) {
  const production = await prisma.production.findUnique({ where: { id }, include: productionInclude });
  if (!production) throw AppError.notFound('Production not found');
  return production;
}
