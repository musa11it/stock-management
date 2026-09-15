import { apiClient } from '@/lib/apiClient';
import type { ApiResponse, DashboardSummary } from '@/types';

export async function fetchDashboardSummary() {
  const { data } = await apiClient.get<ApiResponse<DashboardSummary>>('/dashboard');
  return data.data;
}
