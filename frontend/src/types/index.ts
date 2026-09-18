export type RoleName = 'SUPER_ADMIN' | 'MANAGER' | 'STAFF' | 'RETAIL_USER';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface Role {
  id: string;
  name: RoleName;
  description?: string | null;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  status: UserStatus;
  managerId?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  role: { id: string; name: RoleName };
}

export interface AuthUser extends User {
  permissions?: string[];
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  _count?: { products: number };
}

export interface Unit {
  id: string;
  name: string;
  abbreviation: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location?: string | null;
  isActive: boolean;
}

export type ProductType = 'RAW_MATERIAL' | 'FINISHED_PRODUCT' | 'DIRECT_SALE' | 'PACKAGING';

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  categoryId: string;
  unitId: string;
  /** Null for products created before classification existed - see backend schema notes. */
  type?: ProductType | null;
  category: Category;
  unit: Unit;
  minimumStock: string;
  maximumStock?: string | null;
  costPrice: string;
  sellingPrice?: string | null;
  isPerishable: boolean;
  shelfLifeDays?: number | null;
  isActive: boolean;
  /** The "List for Sale" menu wrapper for this product, if one has been created - see MenuPage/ProductionPage. */
  directSaleMenuItem?: { id: string; name: string; isActive: boolean } | null;
  inventories?: Inventory[];
}

export interface Inventory {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: string;
  averageCost: string;
  /** Soonest expiry among this product/warehouse's active batches - null if non-perishable or no dated batches remain. */
  nearestExpiry?: string | null;
  isExpired?: boolean;
  isNearExpiry?: boolean;
  product: Product;
  warehouse: Warehouse;
}

export type StockMovementType = 'PURCHASE' | 'CONSUMPTION' | 'WASTAGE' | 'SALE' | 'ADJUSTMENT' | 'TRANSFER_OUT' | 'TRANSFER_IN';

export interface StockMovement {
  id: string;
  productId: string;
  warehouseId: string;
  type: StockMovementType;
  quantity: string;
  unitCost?: string | null;
  previousQuantity: string;
  newQuantity: string;
  reason?: string | null;
  createdAt: string;
  product: Product;
  warehouse: Warehouse;
  createdBy: { id: string; firstName: string; lastName: string };
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
}

export type PurchaseStatus = 'DRAFT' | 'PENDING' | 'RECEIVED' | 'PARTIALLY_RECEIVED' | 'CANCELLED';

export interface PurchaseItem {
  id: string;
  productId: string;
  quantity: string;
  receivedQty: string;
  unitCost: string;
  total: string;
  product: Product;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  warehouseId: string;
  invoiceNumber?: string | null;
  purchaseDate: string;
  status: PurchaseStatus;
  subtotal: string;
  tax: string;
  discount: string;
  total: string;
  notes?: string | null;
  receivedAt?: string | null;
  supplier: Supplier;
  warehouse: Warehouse;
  createdBy: { id: string; firstName: string; lastName: string };
  items: PurchaseItem[];
}

export type WastageReason = 'EXPIRED' | 'DAMAGED' | 'SPOILED' | 'BURNED' | 'SPILLED' | 'OTHER';
export type WastageStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface WastageItem {
  id: string;
  productId: string;
  quantity: string;
  unitCost: string;
  product: Product;
}

export interface Wastage {
  id: string;
  wastageNumber: string;
  warehouseId: string;
  reason: WastageReason;
  status: WastageStatus;
  description?: string | null;
  createdAt: string;
  warehouse: Warehouse;
  createdBy: { id: string; firstName: string; lastName: string };
  approvedBy?: { id: string; firstName: string; lastName: string } | null;
  items: WastageItem[];
}

export interface RecipeIngredient {
  id: string;
  productId: string;
  quantity: string;
  product: Product;
}

export interface Recipe {
  id: string;
  name: string;
  description?: string | null;
  menuItemId?: string | null;
  /** Optional link to the finished Product it produces, so Production can load it. */
  finishedProductId?: string | null;
  finishedProduct?: Pick<Product, 'id' | 'name'> | null;
  ingredients: RecipeIngredient[];
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: string;
  category?: string | null;
  isActive: boolean;
  imageUrl?: string | null;
  recipe?: Recipe | null;
}

export type SaleStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';
export type SaleSource = 'POS' | 'ONLINE';
export type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'OTHER';

export interface SaleItem {
  id: string;
  menuItemId: string;
  quantity: number;
  unitPrice: string;
  total: string;
  menuItem: MenuItem;
}

export interface Sale {
  id: string;
  saleNumber: string;
  warehouseId: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  source: SaleSource;
  customerName?: string | null;
  customerId?: string | null;
  createdAt: string;
  /** When the order was accepted/confirmed (moved to COMPLETED) - null until then. */
  confirmedAt?: string | null;
  warehouse: Warehouse;
  createdBy: { id: string; firstName: string; lastName: string; role: { name: RoleName } };
  confirmedBy?: { id: string; firstName: string; lastName: string; role: { name: RoleName } } | null;
  customer?: { id: string; firstName: string; lastName: string; email: string } | null;
  items: SaleItem[];
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string; email: string } | null;
}

export type ExpenseCategory =
  | 'SALARY'
  | 'ELECTRICITY'
  | 'WATER'
  | 'RENT'
  | 'TAX'
  | 'TRANSPORT'
  | 'MAINTENANCE'
  | 'INTERNET'
  | 'MARKETING'
  | 'OTHER';
export type ExpenseStatus = 'PAID';

export interface Expense {
  id: string;
  expenseNumber: string;
  category: ExpenseCategory;
  recipientUserId?: string | null;
  recipientName?: string | null;
  amount: string;
  status: ExpenseStatus;
  description?: string | null;
  createdAt: string;
  createdBy: { id: string; firstName: string; lastName: string; role: { name: RoleName } };
  recipientUser?: { id: string; firstName: string; lastName: string; role: { name: RoleName } } | null;
}

export type ProductionStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED';

export interface ProductionMaterial {
  id: string;
  productId: string;
  /** Which warehouse this material is drawn from - defaults to the run's sourceWarehouseId if not set. */
  warehouseId?: string | null;
  warehouse?: Warehouse | null;
  quantity: string;
  unitCost: string;
  total: string;
  product: Product;
}

export interface Production {
  id: string;
  productionNumber: string;
  finishedProductId: string;
  plannedQuantity: string;
  actualQuantity?: string | null;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  status: ProductionStatus;
  unitCost?: string | null;
  totalCost?: string | null;
  batchNumber?: string | null;
  notes?: string | null;
  createdAt: string;
  completedAt?: string | null;
  finishedProduct: Product;
  sourceWarehouse: Warehouse;
  destinationWarehouse: Warehouse;
  createdBy: { id: string; firstName: string; lastName: string; role: { name: RoleName } };
  materials: ProductionMaterial[];
}

export interface Permission {
  id: string;
  key: string;
  module: string;
  action: string;
  description?: string | null;
}

export interface RoleWithPermissions extends Role {
  permissions: { permission: Permission }[];
  _count?: { users: number };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export type NetProfitPeriod = 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL';

export interface NetProfitResult {
  period: NetProfitPeriod;
  periodStart: string | null;
  revenue: number;
  cogs: number;
  grossProfit: number;
  wastageCost: number;
  consumptionCost: number;
  adjustmentLossCost: number;
  adjustmentGainValue: number;
  expenseCost: number;
  netProfit: number;
}

export interface DashboardSummary {
  totalProducts: number;
  inventoryValue: number;
  lowStockCount: number;
  lowStockProducts: Inventory[];
  todayPurchases: { count: number; total: number };
  todaySales: { count: number; total: number };
  todayWastage: { count: number; quantity: number };
  todayProfit: { revenue: number; cogs: number; profit: number };
  todayIngredientUsage: { productId: string; productName: string; unit: string; quantity: number; cost: number }[];
  todayNetProfit: {
    grossProfit: number;
    wastageCost: number;
    consumptionCost: number;
    adjustmentLossCost: number;
    adjustmentGainValue: number;
    expenseCost: number;
    netProfit: number;
  };
  recentStockMovements: StockMovement[];
  salesOverview: { date: string; total: number }[];
}
