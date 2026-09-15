import { apiClient } from '@/lib/apiClient';
import type { ApiResponse, Wastage } from '@/types';
import { createCrudService } from '@/lib/crudService';

export const wastageCrud = createCrudService<Wastage>('/wastage');

export async function reviewWastage(id: string, approve: boolean) {
  const { data } = await apiClient.post<ApiResponse<Wastage>>(`/wastage/${id}/review`, { approve });
  return data.data;
}
