import { apiClient } from '@/lib/apiClient';
import type { ApiResponse, Inventory, StockMovement, PaginationMeta } from '@/types';

export async function listInventory(params?: Record<string, unknown>) {
  const { data } = await apiClient.get<ApiResponse<Inventory[]>>('/inventory', { params });
  return { data: data.data, meta: data.meta as PaginationMeta };
}

export async function listStockMovements(params?: Record<string, unknown>) {
  const { data } = await apiClient.get<ApiResponse<StockMovement[]>>('/stock-movements', { params });
  return { data: data.data, meta: data.meta as PaginationMeta };
}

export async function adjustStock(input: { productId: string; warehouseId: string; type: 'INCREASE' | 'DECREASE'; quantity: number; reason: string; notes?: string }) {
  const { data } = await apiClient.post('/stock/adjust', input);
  return data.data;
}

export async function consumeStock(input: { productId: string; warehouseId: string; quantity: number; reason?: string }) {
  const { data } = await apiClient.post('/stock/consume', input);
  return data.data;
}

export async function transferStock(input: { productId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number; notes?: string }) {
  const { data } = await apiClient.post('/stock/transfer', input);
  return data.data;
}
