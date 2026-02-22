// Inventory validation schemas — aligned with init.sql inventory + stock_movements tables
import Joi from 'joi';

/**
 * Schema: POST /inventory
 * Create a new inventory record for a product in a warehouse.
 */
export const createInventorySchema = Joi.object({
  warehouse_id: Joi.string().uuid().required(),
  product_id: Joi.string().uuid().optional().allow('', null),
  // Product catalog fields (used to create a product record if no product_id)
  product_name: Joi.string().min(1).max(255).optional().allow('', null),
  category: Joi.string().max(100).optional().allow('', null),
  unit_price: Joi.number().min(0).optional().allow(null),
  // Inventory-specific fields
  quantity: Joi.number().integer().min(0).required(),
  reserved_quantity: Joi.number().integer().min(0).optional().default(0),
  bin_location: Joi.string().max(50).optional().allow('', null),
  zone: Joi.string().max(50).optional().allow('', null),
  reorder_point: Joi.number().integer().min(0).optional().allow(null),
  max_stock_level: Joi.number().integer().min(0).optional().allow(null)
}); // SKU is auto-generated on backend if not supplied

/**
 * Schema: PUT /inventory/:id
 * Update non-critical fields (does NOT replace special ops like reserve/release).
 */
export const updateInventorySchema = Joi.object({
  bin_location: Joi.string().max(50).optional().allow('', null),
  zone: Joi.string().max(50).optional().allow('', null),
  reorder_point: Joi.number().integer().min(0).optional().allow(null),
  max_stock_level: Joi.number().integer().min(0).optional().allow(null)
}).min(1);

/**
 * Schema: POST /inventory/:id/adjust
 * Adjust stock levels on a specific inventory item.
 *
 * adjustment_type values:
 *   add      → stock arrived (inbound)
 *   remove   → stock removed (outbound / write-off)
 *   set      → cycle count: set absolute quantity
 *   damaged  → mark quantity as damaged
 */
export const adjustInventorySchema = Joi.object({
  adjustment_type: Joi.string()
    .valid('add', 'remove', 'set', 'damaged')
    .required(),
  quantity: Joi.number().integer().min(1).required(),
  reason: Joi.string().min(5).max(500).required(),
  reference_id: Joi.string().uuid().optional().allow('', null),
  batch_number: Joi.string().max(100).optional().allow('', null)
});

/**
 * Schema: GET /inventory
 * Query parameters for listing inventory.
 */
export const listInventoryQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  warehouse_id: Joi.string().uuid().optional(),
  search: Joi.string().max(100).optional().allow(''),
  low_stock: Joi.boolean().optional().default(false)
});

/**
 * Schema: POST /inventory/transfer
 * Directly transfer stock between warehouses (without creating a transfer order).
 */
export const transferInventorySchema = Joi.object({
  from_warehouse_id: Joi.string().uuid().required(),
  to_warehouse_id: Joi.string().uuid().required()
    .invalid(Joi.ref('from_warehouse_id'))
    .messages({ 'any.invalid': 'Destination warehouse must differ from source warehouse' }),
  sku: Joi.string().min(1).max(100).required(),
  product_id: Joi.string().uuid().optional().allow('', null),
  quantity: Joi.number().integer().min(1).required(),
  reason: Joi.string().min(5).max(500).required()
});
