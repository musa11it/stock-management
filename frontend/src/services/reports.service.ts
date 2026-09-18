import { apiClient } from '@/lib/apiClient';
import type { ApiResponse } from '@/types';

export interface StockReportRow {
  productId: string;
  productName: string;
  category: string;
  warehouse: string;
  unit: string;
  quantity: number;
  minimumStock: number;
  averageCost: number;
  value: number;
  isLowStock: boolean;
  expiryDate: string | null;
}

export interface StockReport {
  rows: StockReportRow[];
  totalValue: number;
  lowStockCount: number;
}

export interface PurchasesReport {
  purchases: { id: string; purchaseNumber: string; supplier: string; status: string; itemCount: number; total: number; purchaseDate: string }[];
  totalSpend: number;
  bySupplier: { supplierId: string; supplierName: string; count: number; total: number }[];
}

export interface WastageReport {
  wastages: { id: string; wastageNumber: string; warehouse: string; reason: string; status: string; itemCount: number; createdAt: string }[];
  totalValue: number;
  byReason: { reason: string; count: number; totalValue: number }[];
}

export interface SalesReport {
  sales: { id: string; saleNumber: string; itemCount: number; total: number; paymentMethod: string; createdAt: string }[];
  totalRevenue: number;
  byPaymentMethod: { method: string; count: number; total: number }[];
  cogs: number;
  profit: number;
  ingredientUsage: { productId: string; productName: string; unit: string; quantity: number; cost: number }[];
}

export async function fetchStockReport() {
  const { data } = await apiClient.get<ApiResponse<StockReport>>('/reports/stock');
  return data.data;
}

export async function fetchPurchasesReport(params?: { dateFrom?: string; dateTo?: string }) {
  const { data } = await apiClient.get<ApiResponse<PurchasesReport>>('/reports/purchases', { params });
  return data.data;
}

export async function fetchWastageReport(params?: { dateFrom?: string; dateTo?: string }) {
  const { data } = await apiClient.get<ApiResponse<WastageReport>>('/reports/wastage', { params });
  return data.data;
}

export async function fetchSalesReport(params?: { dateFrom?: string; dateTo?: string }) {
  const { data } = await apiClient.get<ApiResponse<SalesReport>>('/reports/sales', { params });
  return data.data;
}
