export type UserRole = 'owner' | 'cashier' | 'employee';
export type SaleStatus = 'pending' | 'completed' | 'cancelled' | 'refunded';
export type SaleChannel = 'local' | 'mercadolibre' | 'instagram' | 'whatsapp' | 'other';
export type StockMovementType = 'in' | 'out' | 'adjustment';
export type StockMovementReason = 'supplier' | 'sale' | 'return' | 'loss' | 'manual' | 'correction';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mercadopago' | 'other';
export type UnitType = 'unit' | 'kg' | 'liter' | 'pack' | 'gram';

// ─── Permisos ────────────────────────────────────────────────
export type Permission =
  | 'stock.view' | 'stock.create' | 'stock.edit' | 'stock.delete'
  | 'products.view' | 'products.create' | 'products.edit' | 'products.delete'
  | 'sales.view' | 'sales.create' | 'sales.cancel' | 'sales.refund'
  | 'external_sales.view' | 'external_sales.create'
  | 'reports.view' | 'reports.export'
  | 'employees.view' | 'employees.manage'
  | 'cash_register.open' | 'cash_register.close'
  | 'settings.view' | 'settings.manage';

export interface RolePermission {
  id: string;
  role: UserRole;
  permission: Permission;
  is_allowed: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Establecimiento ─────────────────────────────────────────
export interface Establishment {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  tax_id: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

// ─── Perfiles ────────────────────────────────────────────────
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  establishment_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Categorías de productos ─────────────────────────────────
export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Productos (catálogo global) ─────────────────────────────
export interface Product {
  id: string;
  barcode: string;
  name: string;
  brand: string | null;
  category_id: string | null;
  unit_type: UnitType;
  image_url: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // relations
  category?: ProductCategory;
}

// ─── Productos por establecimiento ───────────────────────────
export interface EstablishmentProduct {
  id: string;
  establishment_id: string;
  product_id: string;
  price: number;
  cost_price: number | null;
  stock: number;
  stock_min_alert: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // relations
  product?: Product;
}

// Tipo combinado que devuelve la vista establishment_products_detail
export interface EstablishmentProductDetail {
  id: string;
  establishment_id: string;
  product_id: string;
  price: number;
  cost_price: number | null;
  stock: number;
  stock_min_alert: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // campos de products
  barcode: string;
  name: string;
  brand: string | null;
  unit_type: UnitType;
  image_url: string | null;
  // campos de product_categories
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  // campo calculado
  is_low_stock: boolean;
}

// ─── Proveedores ─────────────────────────────────────────────
export interface Supplier {
  id: string;
  establishment_id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Órdenes de proveedor ────────────────────────────────────
export interface SupplierOrder {
  id: string;
  establishment_id: string;
  supplier_id: string | null;
  status: 'draft' | 'confirmed' | 'cancelled';
  total_items: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
}

// ─── Movimientos de stock ────────────────────────────────────
export interface StockMovement {
  id: string;
  establishment_product_id: string;
  supplier_order_id: string | null;
  type: StockMovementType;
  reason: StockMovementReason;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  unit_cost: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  establishment_product?: EstablishmentProduct;
  created_by_profile?: Profile;
}

// Resultado del RPC confirm_supplier_order
export interface ConfirmedOrderSummary {
  order_id: string;
  total_items: number;
  movements: Array<{
    ep_id: string;
    product_id: string;
    previous_stock: number;
    new_stock: number;
    quantity: number;
  }>;
}

// ─── Ventas externas ─────────────────────────────────────────
export interface ExternalSale {
  id: string;
  establishment_id: string;
  seller_id: string;
  register_payment: boolean;
  total: number | null;
  payment_method: 'cash' | 'transfer' | null;
  customer_name: string | null;
  notes: string | null;
  status: 'confirmed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface ExternalSaleItem {
  id: string;
  external_sale_id: string;
  establishment_product_id: string;
  product_name: string;
  product_barcode: string | null;
  quantity: number;
  unit_price: number | null;
  subtotal: number | null;
}

export interface ConfirmedExternalSaleSummary {
  sale_id: string;
  movements: Array<{
    ep_id: string;
    name: string;
    quantity: number;
    previous_stock: number;
    new_stock: number;
  }>;
}

// ─── Ventas ──────────────────────────────────────────────────
export interface Sale {
  id: string;
  sale_number: string;
  establishment_id: string;
  channel: SaleChannel;
  status: SaleStatus;
  cashier_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  notes: string | null;
  created_at: string;
  updated_at: string;
  cashier?: Profile;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  establishment_product_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
  establishment_product?: EstablishmentProduct;
}

// ─── Ventas Externas ─────────────────────────────────────────
export interface ExternalSale {
  id: string;
  sale_id: string;
  channel: Exclude<SaleChannel, 'local'>;
  external_reference: string | null;
  platform_fee: number;
  shipping_cost: number;
  net_amount: number;
  notes: string | null;
  created_at: string;
  sale?: Sale;
}

// ─── Cajas / Turnos ──────────────────────────────────────────
export interface CashRegisterSession {
  id: string;
  establishment_id: string;
  cashier_id: string;
  opening_amount: number;
  closing_amount: number | null;
  expected_amount: number | null;
  difference: number | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
  cashier?: Profile;
  sales?: Sale[];
}

// ─── Tipos de utilidad ───────────────────────────────────────
export type SaleWithItems = Sale & { items: SaleItem[] };

export type DbResult<T> = T extends PromiseLike<infer U> ? U : never;
export type DbResultOk<T> = T extends PromiseLike<{ data: infer U }> ? Exclude<U, null> : never;
