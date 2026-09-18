import { apiClient } from '@/lib/apiClient';
import type { ApiResponse, PaginationMeta, Production } from '@/types';
import { createCrudService } from '@/lib/crudService';

export interface CreateProductionInput {
  finishedProductId: string;
  plannedQuantity: number;
  sourceWarehouseId: string;
  destinationWarehouseId?: string;
  batchNumber?: string;
  notes?: string;
  materials: { productId: string; quantity: number }[];
}

export const productionCrud = createCrudService<Production, CreateProductionInput>('/production');

export async function listProductions(params?: Record<string, unknown>) {
  const { data } = await apiClient.get<ApiResponse<Production[]>>('/production', { params });
  return { data: data.data, meta: data.meta as PaginationMeta };
}

export async function completeProduction(id: string, actualQuantity?: number) {
  const { data } = await apiClient.post<ApiResponse<Production>>(`/production/${id}/complete`, { actualQuantity });
  return data.data;
}

export async function cancelProduction(id: string) {
  const { data } = await apiClient.post<ApiResponse<Production>>(`/production/${id}/cancel`);
  return data.data;
}
