import { z } from 'zod';

// ============================================
// Order Validation Schemas
// ============================================

export const createOrderSchema = z.object({
  customerName: z.string().min(2, 'Customer name must be at least 2 characters').max(100),
  customerEmail: z.string().email('Invalid email address'),
  customerPhone: z.string().min(10, 'Phone must be at least 10 characters').optional(),
  shippingAddress: z.object({
    street: z.string().min(5, 'Street address is required'),
    city: z.string().min(2),
    state: z.string().min(2),
    zipCode: z.string().min(5),
    country: z.string().min(2),
  }),
  billingAddress: z.object({
    street: z.string().min(5),
    city: z.string().min(2),
    state: z.string().min(2),
    zipCode: z.string().min(5),
    country: z.string().min(2),
  }).optional(),
  items: z.array(z.object({
    productId: z.string().uuid('Invalid product ID'),
    productName: z.string().min(1),
    quantity: z.number().int().positive('Quantity must be positive'),
    price: z.number().positive('Price must be positive'),
    warehouseId: z.string().uuid('Invalid warehouse ID').optional(),
  })).min(1, 'At least one item is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  notes: z.string().max(500).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
  notes: z.string().max(500).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

// ============================================
// Shipment Validation Schemas
// ============================================

export const createShipmentSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  carrierId: z.string().uuid('Invalid carrier ID'),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  trackingNumber: z.string().min(5).max(50),
  origin: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string(),
  }),
  destination: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string(),
  }),
  weight: z.number().positive().optional(),
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
    unit: z.enum(['cm', 'in']),
  }).optional(),
  shippingCost: z.number().positive().optional(),
  estimatedDelivery: z.string().datetime().optional(),
});

export const updateShipmentStatusSchema = z.object({
  status: z.enum(['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned']),
  location: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
export type UpdateShipmentStatusInput = z.infer<typeof updateShipmentStatusSchema>;

// ============================================
// Inventory Validation Schemas
// ============================================

export const createInventoryItemSchema = z.object({
  productName: z.string().min(2).max(200),
  sku: z.string().min(3).max(50),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  quantity: z.number().int().min(0, 'Quantity cannot be negative'),
  minStockLevel: z.number().int().min(0).optional(),
  maxStockLevel: z.number().int().min(0).optional(),
  price: z.number().positive().optional(),
  category: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
});

export const updateInventoryQuantitySchema = z.object({
  quantity: z.number().int().min(0),
  warehouseId: z.string().uuid().optional(),
  reason: z.string().max(200).optional(),
});

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;
export type UpdateInventoryQuantityInput = z.infer<typeof updateInventoryQuantitySchema>;

// ============================================
// Return Validation Schemas
// ============================================

export const createReturnSchema = z.object({
  orderId: z.string().uuid('Invalid order ID'),
  reason: z.enum(['defective', 'wrong_item', 'damaged', 'not_as_described', 'changed_mind', 'other']),
  items: z.array(z.object({
    productId: z.string().uuid(),
    productName: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
    reason: z.string().max(200).optional(),
  })).min(1, 'At least one item is required'),
  comments: z.string().max(1000).optional(),
  requestPickup: z.boolean().default(false),
  pickupAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string(),
  }).optional(),
});

export const updateReturnStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'picked_up', 'inspecting', 'completed', 'cancelled']),
  inspectionNotes: z.string().max(1000).optional(),
  refundAmount: z.number().positive().optional(),
  refundMethod: z.enum(['original_payment', 'store_credit', 'bank_transfer']).optional(),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;
export type UpdateReturnStatusInput = z.infer<typeof updateReturnStatusSchema>;

// ============================================
// Warehouse Validation Schemas
// ============================================

export const createWarehouseSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
  capacity: z.number().int().positive().optional(),
  contactPerson: z.string().max(100).optional(),
  contactPhone: z.string().max(20).optional(),
  contactEmail: z.string().email().optional(),
  operatingHours: z.string().max(200).optional(),
  isActive: z.boolean().default(true),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;

// ============================================
// Carrier Validation Schemas
// ============================================

export const createCarrierSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20),
  type: z.enum(['express', 'standard', 'economy', 'freight']),
  contactPerson: z.string().max(100).optional(),
  contactPhone: z.string().max(20).optional(),
  contactEmail: z.string().email().optional(),
  baseRate: z.number().positive().optional(),
  isActive: z.boolean().default(true),
});

export type CreateCarrierInput = z.infer<typeof createCarrierSchema>;

// ============================================
// Exception Validation Schemas
// ============================================

export const createExceptionSchema = z.object({
  type: z.enum([
    'delivery_delay',
    'damage_report',
    'lost_package',
    'address_issue',
    'payment_failed',
    'inventory_shortage',
    'carrier_issue',
    'system_error',
    'other'
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  entityType: z.enum(['order', 'shipment', 'inventory', 'return']),
  entityId: z.string().uuid(),
  description: z.string().min(10).max(1000),
  assignedTo: z.string().uuid().optional(),
});

export const updateExceptionSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
  resolution: z.string().max(1000).optional(),
  assignedTo: z.string().uuid().optional(),
});

export type CreateExceptionInput = z.infer<typeof createExceptionSchema>;
export type UpdateExceptionInput = z.infer<typeof updateExceptionSchema>;

// ============================================
// SLA Validation Schemas
// ============================================

export const createSLAPolicySchema = z.object({
  name: z.string().min(2).max(100),
  serviceType: z.string().min(2).max(50),
  region: z.string().min(2).max(100),
  targetDeliveryHours: z.number().int().positive(),
  penaltyAmount: z.number().positive(),
  gracePeriodHours: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  carrierIds: z.array(z.string().uuid()).optional(),
});

export type CreateSLAPolicyInput = z.infer<typeof createSLAPolicySchema>;

// ============================================
// User/Auth Validation Schemas
// ============================================

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().default(false),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  companyName: z.string().max(100).optional(),
  agreedToTerms: z.boolean().refine(val => val === true, 'You must agree to terms'),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  phone: z.string().max(20).optional(),
  jobTitle: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
  language: z.string().max(10).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ============================================
// Filter Validation Schemas
// ============================================

export const dateRangeSchema = z.object({
  start: z.string().datetime().or(z.date()),
  end: z.string().datetime().or(z.date()),
}).refine(data => new Date(data.start) <= new Date(data.end), {
  message: 'Start date must be before end date',
});

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type DateRangeInput = z.infer<typeof dateRangeSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
