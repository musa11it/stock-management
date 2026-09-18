import { apiClient } from '@/lib/apiClient';
import type { ApiResponse, Expense, PaginationMeta } from '@/types';
import { createCrudService } from '@/lib/crudService';

export const expenseCrud = createCrudService<Expense>('/expenses');

export async function listMyExpenses(params?: { page?: number; limit?: number }) {
  const { data } = await apiClient.get<ApiResponse<Expense[]>>('/expenses/my', { params });
  return { data: data.data, meta: data.meta as PaginationMeta };
}

export async function getMyExpense(id: string) {
  const { data } = await apiClient.get<ApiResponse<Expense>>(`/expenses/my/${id}`);
  return data.data;
}
