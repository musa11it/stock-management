import { apiClient } from '@/lib/apiClient';
import type { ApiResponse } from '@/types';

export interface PublicMenuIngredient {
  quantity: string;
  product: { name: string; unit: { abbreviation: string } };
}

export interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  category: string | null;
  imageUrl: string | null;
  recipe: { ingredients: PublicMenuIngredient[] } | null;
}

export async function fetchPublicMenu(search?: string) {
  const { data } = await apiClient.get<ApiResponse<PublicMenuItem[]>>('/public/menu', { params: { search } });
  return data.data;
}
