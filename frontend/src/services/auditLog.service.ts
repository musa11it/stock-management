import { apiClient } from '@/lib/apiClient';
import type { ApiResponse, AuditLog, PaginationMeta } from '@/types';

export async function listAuditLogs(params?: Record<string, unknown>) {
  const { data } = await apiClient.get<ApiResponse<AuditLog[]>>('/audit-logs', { params });
  return { data: data.data, meta: data.meta as PaginationMeta };
}
