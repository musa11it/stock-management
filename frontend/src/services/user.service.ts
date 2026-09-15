import { createCrudService } from '@/lib/crudService';
import { apiClient } from '@/lib/apiClient';
import type { ApiResponse, User, RoleWithPermissions, Permission } from '@/types';

export const userService = createCrudService<User>('/users');

export async function listRoles() {
  const { data } = await apiClient.get<ApiResponse<RoleWithPermissions[]>>('/roles');
  return data.data;
}

export async function listPermissions() {
  const { data } = await apiClient.get<ApiResponse<Permission[]>>('/permissions');
  return data.data;
}
