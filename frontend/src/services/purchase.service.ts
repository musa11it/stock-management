import { apiClient } from '@/lib/apiClient';
import type { ApiResponse, Purchase } from '@/types';
import { createCrudService } from '@/lib/crudService';

export const purchaseCrud = createCrudService<Purchase>('/purchases');

export async function receivePurchase(id: string, items?: { productId: string; receivedQty: number }[]) {
  const { data } = await apiClient.post<ApiResponse<Purchase>>(`/purchases/${id}/receive`, { items });
  return data.data;
}
