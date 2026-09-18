import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as stockService from '@/services/stock.service';

/**
 * The product-warehouse "assignment" a product becomes locked to once it has stock recorded
 * there - reusing the existing Inventory relationship (one row per product+warehouse) rather
 * than a second assignment table. Fetched once and reused by every stock-related form so the
 * warehouse-then-product filtering logic lives in exactly one place.
 */
export function useProductAssignments() {
  const { data, isLoading } = useQuery({
    queryKey: ['inventory', 'assignments'],
    // 500 is the API's hard max page size (backend/src/validators/common.ts) - requesting more
    // fails validation and silently empties this out, making every warehouse look unassigned.
    queryFn: () => stockService.listInventory({ limit: 500 }),
  });

  const { byWarehouse, assignedAnywhere } = useMemo(() => {
    const byWarehouse = new Map<string, Set<string>>();
    const assignedAnywhere = new Set<string>();
    for (const inv of data?.data ?? []) {
      if (!byWarehouse.has(inv.warehouseId)) byWarehouse.set(inv.warehouseId, new Set());
      byWarehouse.get(inv.warehouseId)!.add(inv.productId);
      assignedAnywhere.add(inv.productId);
    }
    return { byWarehouse, assignedAnywhere };
  }, [data]);

  return {
    isLoading,
    /** Products already assigned to this warehouse (have a stock record there). */
    productsForWarehouse: (warehouseId: string): Set<string> => byWarehouse.get(warehouseId) ?? new Set(),
    /** True if this product has never had a stock record in any warehouse yet. */
    isUnassignedAnywhere: (productId: string): boolean => !assignedAnywhere.has(productId),
  };
}

export interface ProductOption {
  id: string;
  name: string;
}

/**
 * Filters `products` down to what's valid to pick for `warehouseId`.
 * - strict (consume/wastage/decrease/transfer-out): only products already assigned there.
 * - allowNewAssignment (purchase/increase): also allows products never assigned anywhere yet,
 *   since that first stock record is how an assignment gets created in the first place.
 * Returns the full, unfiltered list until a warehouse is chosen, so existing behavior is
 * unchanged for that state.
 */
export function filterProductsForWarehouse<T extends ProductOption>(
  products: T[],
  warehouseId: string,
  assignments: Pick<ReturnType<typeof useProductAssignments>, 'productsForWarehouse' | 'isUnassignedAnywhere'>,
  allowNewAssignment: boolean,
): T[] {
  if (!warehouseId) return products;
  const assigned = assignments.productsForWarehouse(warehouseId);
  return products.filter((p) => assigned.has(p.id) || (allowNewAssignment && assignments.isUnassignedAnywhere(p.id)));
}
