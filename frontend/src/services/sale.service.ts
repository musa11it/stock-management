import { apiClient } from '@/lib/apiClient';
import type { ApiResponse, Sale } from '@/types';
import { createCrudService } from '@/lib/crudService';

export const saleCrud = createCrudService<Sale>('/sales');

export async function cancelSale(id: string) {
  const { data } = await apiClient.post<ApiResponse<Sale>>(`/sales/${id}/cancel`);
  return data.data;
}

export async function updateSaleStatus(id: string, status: 'COMPLETED' | 'CANCELLED') {
  const { data } = await apiClient.patch<ApiResponse<Sale>>(`/sales/${id}/status`, { status });
  return data.data;
}
