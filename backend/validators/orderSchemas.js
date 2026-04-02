// Order validation schemas - defines rules for order creation and updates
import Joi from 'joi';

const dimensionsSchema = Joi.object({
  length: Joi.number().min(0).optional(),
  width: Joi.number().min(0).optional(),
  height: Joi.number().min(0).optional(),
  unit: Joi.string().valid('cm', 'in').optional().default('cm')
});

const orderItemSchema = Joi.object({
  // Identity
  product_id: Joi.string().uuid().optional(),
  sku: Joi.string().max(100).required(),
  product_name: Joi.string().max(255).required(),
  // Quantities
  quantity: Joi.number().integer().min(1).required(),
  // Pricing (all computed server-side if omitted, but frontend can send them)
  unit_price: Joi.number().min(0).required(),
  discount: Joi.number().min(0).optional().default(0),
  tax: Joi.number().min(0).optional().default(0),
  total_price: Joi.number().min(0).optional(), // computed as unit_price*qty if omitted
  // Physical attributes (needed for shipping estimates)
  weight: Joi.number().min(0).optional(),
  dimensions: dimensionsSchema.optional(),
  // Handling flags
  is_fragile: Joi.boolean().optional().default(false),
  is_hazardous: Joi.boolean().optional().default(false),
  is_perishable: Joi.boolean().optional().default(false),
  requires_cold_storage: Joi.boolean().optional().default(false),
  // Classification
  item_type: Joi.string().valid('general', 'electronics', 'fragile', 'hazardous', 'perishable', 'document', 'apparel').optional().default('general'),
  package_type: Joi.string().valid('box', 'envelope', 'pallet', 'tube', 'bag').optional().default('box'),
  handling_instructions: Joi.string().max(500).optional().allow(''),
  // Insurance
  requires_insurance: Joi.boolean().optional().default(false),
  declared_value: Joi.number().min(0).optional(),
  // Fulfillment
  warehouse_id: Joi.string().uuid().optional()
});

const addressSchema = Joi.object({
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().optional().allow(''),
  postal_code: Joi.string().required(),
  country: Joi.string().required(),
  lat: Joi.number().optional(),
  lon: Joi.number().optional()
});

export const createOrderSchema = Joi.object({
  // order_type must match DB check constraint: outbound (customer sale), transfer (warehouse-to-warehouse), inbound_restock (supplier PO)
  order_type: Joi.string().valid('outbound', 'transfer', 'inbound_restock').optional().default('outbound'),
  order_number: Joi.string().min(3).max(50).optional(),
  customer_name: Joi.string().min(2).max(255).required(),
  customer_email: Joi.string().email().required(),
  customer_phone: Joi.string().min(7).max(20).optional().allow(''),
  // status intentionally excluded — server always creates orders with status 'created'
  priority: Joi.string().valid('express', 'standard', 'bulk', 'same_day').optional().default('standard'),
  is_cod: Joi.boolean().optional().default(false),
  // Financial breakdown (all totals computed server-side from items; client values ignored)
  subtotal: Joi.number().min(0).optional(),
  tax_amount: Joi.number().min(0).optional().default(0),
  shipping_amount: Joi.number().min(0).optional().default(0),
  discount_amount: Joi.number().min(0).optional().default(0),
  total_amount: Joi.number().min(0).optional(), // ignored — server recalculates from items
  currency: Joi.string().valid('USD', 'EUR', 'GBP', 'INR').optional().default('INR'),
  // Addresses
  shipping_address: addressSchema.required(),
  billing_address: addressSchema.optional(),
  // Timing
  estimated_delivery: Joi.string().isoDate().optional(),
  // Payment
  payment_method: Joi.string().valid('prepaid', 'cod', 'credit', 'wallet', 'upi', 'netbanking', 'card').optional(),
  // Notes
  notes: Joi.string().max(1000).optional().allow(''),
  special_instructions: Joi.string().max(1000).optional().allow(''),
  tags: Joi.array().items(Joi.string()).optional(),
  // Items
  items: Joi.array().items(orderItemSchema).min(1).required(),
  // Controller flag - not stored in DB
  requestCarrierAssignment: Joi.boolean().optional()
});

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid(
    'created', 'confirmed', 'allocated', 'processing', 'ready_to_ship', 
    'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'returned', 
    'cancelled', 'on_hold', 'pending_carrier_assignment'
  ).required(),
  notes: Joi.string().max(1000).optional().allow('')
});

export const listOrdersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid(
    'created', 'confirmed', 'allocated', 'processing', 'ready_to_ship', 
    'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'returned', 
    'cancelled', 'on_hold', 'pending_carrier_assignment'
  ).optional(),
  search: Joi.string().max(100).optional().allow(''),
  sortBy: Joi.string().valid('created_at', 'updated_at', 'total_amount', 'status').optional().default('created_at'),
  sortOrder: Joi.string().valid('ASC', 'DESC').optional().default('DESC')
});

// Transfer Order Schema - for warehouse-to-warehouse inventory transfers
// This creates an order that tracks inventory movement between warehouses
// When delivered, automatically executes inventory transfer
export const createTransferOrderSchema = Joi.object({
  from_warehouse_id: Joi.string().required(),
  to_warehouse_id: Joi.string().required().invalid(Joi.ref('from_warehouse_id')).messages({
    'any.invalid': 'Destination warehouse must be different from source warehouse'
  }),
  from_warehouse_name: Joi.string().max(255).optional().allow(''),
  to_warehouse_name: Joi.string().max(255).optional().allow(''),
  from_warehouse_code: Joi.string().max(100).optional().allow(''),
  to_warehouse_code: Joi.string().max(100).optional().allow(''),
  items: Joi.array().items(
    Joi.object({
      product_id: Joi.string().required(),
      sku: Joi.string().required(),
      product_name: Joi.string().required(),
      quantity: Joi.number().integer().min(1).required(),
      unit_cost: Joi.number().min(0).optional().default(0)
    })
  ).min(1).required(),
  priority: Joi.string().valid('express', 'standard', 'bulk').optional().default('standard'),
  reason: Joi.string().min(5).max(500).required(),
  requested_by: Joi.string().optional(),
  notes: Joi.string().max(1000).optional().allow(''),
  expected_delivery_date: Joi.date().iso().min('now').optional()
});

export const cancelOrderSchema = Joi.object({
  reason: Joi.string().max(500).optional().allow(''),
});

export const initiateReturnFromOrderSchema = Joi.object({
  reason: Joi.string().max(100).required(),
  reason_details: Joi.string().max(1000).optional().allow(''),
  customer_email: Joi.string().email().optional(),
  refund_amount: Joi.number().min(0).optional(),
  items: Joi.array().items(
    Joi.object({
      product_id: Joi.string().uuid().optional(),
      sku: Joi.string().max(100).optional(),
      quantity: Joi.number().integer().min(1).required(),
      condition: Joi.string().max(100).optional().allow(''),
    }).or('product_id', 'sku')
  ).optional(),
});
