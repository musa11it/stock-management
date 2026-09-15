import { apiClient } from '@/lib/apiClient';
import type { ApiResponse, PaginationMeta, PaymentMethod, Sale, SaleStatus } from '@/types';

export interface PlaceOrderInput {
  paymentMethod?: PaymentMethod;
  items: { menuItemId: string; quantity: number }[];
}

export async function placeOrder(input: PlaceOrderInput) {
  const { data } = await apiClient.post<ApiResponse<Sale>>('/orders', input);
  return data.data;
}

export async function listMyOrders(params?: { page?: number; limit?: number; status?: SaleStatus }) {
  const { data } = await apiClient.get<ApiResponse<Sale[]>>('/orders', { params });
  return { data: data.data, meta: data.meta as PaginationMeta };
}

export async function getMyOrder(id: string) {
  const { data } = await apiClient.get<ApiResponse<Sale>>(`/orders/${id}`);
  return data.data;
}
