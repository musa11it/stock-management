import { createCrudService } from '@/lib/crudService';
import type { Category, Unit, Warehouse, Supplier, Product } from '@/types';

export const categoryService = createCrudService<Category>('/categories');
export const unitService = createCrudService<Unit>('/units');
export const warehouseService = createCrudService<Warehouse>('/warehouses');
export const supplierService = createCrudService<Supplier>('/suppliers');
export const productService = createCrudService<Product>('/products');
