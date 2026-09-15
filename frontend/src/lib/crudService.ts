import { apiClient } from './apiClient';
import type { ApiResponse, PaginationMeta } from '@/types';

export interface ListResult<T> {
  data: T[];
  meta?: PaginationMeta;
}

export function createCrudService<T, CreateInput = Record<string, unknown>, UpdateInput = Record<string, unknown>>(basePath: string) {
  return {
    list: async (params?: Record<string, unknown>): Promise<ListResult<T>> => {
      const { data } = await apiClient.get<ApiResponse<T[]>>(basePath, { params });
      return { data: data.data, meta: data.meta };
    },
    get: async (id: string): Promise<T> => {
      const { data } = await apiClient.get<ApiResponse<T>>(`${basePath}/${id}`);
      return data.data;
    },
    create: async (input: CreateInput): Promise<T> => {
      const { data } = await apiClient.post<ApiResponse<T>>(basePath, input);
      return data.data;
    },
    update: async (id: string, input: UpdateInput): Promise<T> => {
      const { data } = await apiClient.patch<ApiResponse<T>>(`${basePath}/${id}`, input);
      return data.data;
    },
    remove: async (id: string): Promise<void> => {
      await apiClient.delete(`${basePath}/${id}`);
    },
  };
}
