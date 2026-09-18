import { apiClient } from '@/lib/apiClient';
import type { ApiResponse, DashboardSummary, NetProfitPeriod, NetProfitResult } from '@/types';

export async function fetchDashboardSummary() {
  const { data } = await apiClient.get<ApiResponse<DashboardSummary>>('/dashboard');
  return data.data;
}

/** Same underlying Net Profit calculation as the dashboard summary, just recomputed for the chosen period. */
export async function fetchNetProfit(period: NetProfitPeriod) {
  const { data } = await apiClient.get<ApiResponse<NetProfitResult>>('/dashboard/net-profit', { params: { period } });
  return data.data;
}
