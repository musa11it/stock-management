import { apiClient } from '@/lib/apiClient';
import { createCrudService } from '@/lib/crudService';
import type { ApiResponse, Recipe, MenuItem } from '@/types';

export const recipeService = createCrudService<Recipe>('/recipes');
export const menuItemService = createCrudService<MenuItem>('/menu');

/** "List for Sale": creates (or reuses, if one already exists) the sellable MenuItem for a Product. */
export async function listProductForSale(productId: string): Promise<MenuItem> {
  const { data } = await apiClient.post<ApiResponse<MenuItem>>('/menu/from-product', { productId });
  return data.data;
}
