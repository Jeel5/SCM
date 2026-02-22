// Master Data Management (MDM) Controller
// Handles warehouses, carriers, products, SLA policies, and rate cards.
import pool from '../configs/db.js';
import WarehouseRepository from '../repositories/WarehouseRepository.js';
import CarrierRepository from '../repositories/CarrierRepository.js';
import { asyncHandler } from '../errors/errorHandler.js';
import { NotFoundError, BusinessLogicError } from '../errors/index.js';
import logger from '../utils/logger.js';

// ========== WAREHOUSES ==========

// Get warehouses list with filters
export const listWarehouses = asyncHandler(async (req, res) => {
  // Use validatedQuery from middleware (already validated)
  const queryParams = req.validatedQuery || req.query;
  const { page, limit, is_active, warehouse_type, search } = queryParams;

  // Get organization context for multi-tenancy
  const organizationId = req.orgContext?.organizationId;

  const { warehouses, totalCount } = await WarehouseRepository.findWarehouses({
    page,
    limit,
    is_active,
    warehouse_type,
    search,
    organizationId
  });

  // Get inventory count and total quantities for utilization per warehouse
  const warehouseIds = warehouses.map(w => w.id);
  let inventoryCounts = {};
  let warehouseQtys = {};

  if (warehouseIds.length > 0) {
    const inventoryStatsResult = await pool.query(
      `SELECT warehouse_id,
              COUNT(*) AS inventory_count,
              COALESCE(SUM(available_quantity + reserved_quantity + damaged_quantity + in_transit_quantity), 0) AS total_qty
       FROM inventory
       WHERE warehouse_id = ANY($1)
       GROUP BY warehouse_id`,
      [warehouseIds]
    );

    inventoryStatsResult.rows.forEach(row => {
      inventoryCounts[row.warehouse_id] = parseInt(row.inventory_count);
      warehouseQtys[row.warehouse_id] = parseInt(row.total_qty);
    });
  }

  const transformedWarehouses = warehouses.map(w => {
    const capacity = w.capacity || 0;
    const totalQty = warehouseQtys[w.id] || 0;
    const utilization = capacity > 0 ? Math.min(Math.round((totalQty / capacity) * 100), 100) : 0;

    return {
      id: w.id,
      code: w.code,
      name: w.name,
      type: w.warehouse_type,
      address: w.address,
      coordinates: w.coordinates,
      capacity,
      currentUtilization: totalQty,
      utilizationPercentage: utilization,
      inventoryCount: inventoryCounts[w.id] || 0,
      zones: w.zones || 0,
      location: w.coordinates || { lat: 0, lng: 0 },
      status: w.is_active ? 'active' : 'inactive',
      contactEmail: w.contact_email,
      contactPhone: w.contact_phone,
      operatingHours: w.operating_hours || { open: '00:00', close: '23:59', timezone: 'UTC' },
      managerId: w.manager_id,
      managerName: w.manager_name,
      createdAt: w.created_at,
      updatedAt: w.updated_at
    };
  });

  res.json({
    success: true,
    data: transformedWarehouses,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  });
});

// Get warehouse by ID
export const getWarehouse = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get organization context for multi-tenancy
  const organizationId = req.orgContext?.organizationId;

  const warehouse = await WarehouseRepository.findByIdWithDetails(id, organizationId);
  if (!warehouse) {
    throw new NotFoundError('Warehouse');
  }

  // Get inventory count and total quantity for dynamic utilization
  const inventoryStatsResult = await pool.query(
    `SELECT COUNT(*) AS inventory_count,
            COALESCE(SUM(available_quantity + reserved_quantity + damaged_quantity + in_transit_quantity), 0) AS total_qty
     FROM inventory
     WHERE warehouse_id = $1`,
    [id]
  );

  const inventoryCount = parseInt(inventoryStatsResult.rows[0]?.inventory_count) || 0;
  const totalQty = parseInt(inventoryStatsResult.rows[0]?.total_qty) || 0;
  const capacity = warehouse.capacity || 0;
  const utilizationPercentage = capacity > 0 ? Math.min(Math.round((totalQty / capacity) * 100), 100) : 0;

  const transformed = {
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    type: warehouse.warehouse_type,
    address: warehouse.address,
    coordinates: warehouse.coordinates,
    capacity,
    currentUtilization: totalQty,
    utilizationPercentage,
    inventoryCount,
    zones: warehouse.zones || 0,
    location: warehouse.coordinates || { lat: 0, lng: 0 },
    status: warehouse.is_active ? 'active' : 'inactive',
    contactEmail: warehouse.contact_email,
    contactPhone: warehouse.contact_phone,
    operatingHours: warehouse.operating_hours || { open: '00:00', close: '23:59', timezone: 'UTC' },
    managerId: warehouse.manager_id,
    managerName: warehouse.manager_name,
    managerEmail: warehouse.manager_email,
    managerPhone: warehouse.manager_phone,
    createdAt: warehouse.created_at,
    updatedAt: warehouse.updated_at
  };

  res.json({ success: true, data: transformed });
});

// Create warehouse
export const createWarehouse = asyncHandler(async (req, res) => {
  // req.body already validated by middleware
  const value = req.body;

  // Get organization context for multi-tenancy
  const organizationId = req.orgContext?.organizationId;

  if (!organizationId) {
    // Superadmins must specify organization_id explicitly
    if (!value.organization_id) {
      throw new BusinessLogicError('organization_id is required');
    }
  }

  const warehouseOrgId = organizationId || value.organization_id;

  // Check if code already exists (if provided)
  if (value.code) {
    const existingWarehouse = await WarehouseRepository.findByCode(value.code);
    if (existingWarehouse) {
      throw new BusinessLogicError(`Warehouse code '${value.code}' already exists`);
    }
  }

  // Add organization_id to warehouse data
  const warehouseData = {
    ...value,
    organization_id: warehouseOrgId
  };

  const warehouse = await WarehouseRepository.createWarehouse(warehouseData);

  const transformed = {
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    type: warehouse.warehouse_type,
    address: warehouse.address,
    coordinates: warehouse.coordinates,
    capacity: warehouse.capacity,
    currentUtilization: warehouse.current_utilization,
    location: warehouse.coordinates || { lat: 0, lng: 0 },
    status: warehouse.is_active ? 'active' : 'inactive',
    contactEmail: warehouse.contact_email,
    contactPhone: warehouse.contact_phone,
    managerId: warehouse.manager_id,
    createdAt: warehouse.created_at
  };

  res.status(201).json({ success: true, data: transformed });
});

// Update warehouse
export const updateWarehouse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // req.body already validated by middleware
  const value = req.body;

  // Get organization context for multi-tenancy
  const organizationId = req.orgContext?.organizationId;

  // Check warehouse exists (org-scoped)
  const existingWarehouse = await WarehouseRepository.findByIdWithDetails(id, organizationId);
  if (!existingWarehouse) {
    throw new NotFoundError('Warehouse');
  }

  const warehouse = await WarehouseRepository.updateWarehouse(id, value);

  const transformed = {
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    type: warehouse.warehouse_type,
    address: warehouse.address,
    coordinates: warehouse.coordinates,
    capacity: warehouse.capacity,
    currentUtilization: warehouse.current_utilization,
    location: warehouse.coordinates || { lat: 0, lng: 0 },
    status: warehouse.is_active ? 'active' : 'inactive',
    contactEmail: warehouse.contact_email,
    contactPhone: warehouse.contact_phone,
    managerId: warehouse.manager_id,
    updatedAt: warehouse.updated_at
  };

  res.json({ success: true, data: transformed });
});

// Delete/deactivate warehouse
export const deleteWarehouse = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get organization context for multi-tenancy
  const organizationId = req.orgContext?.organizationId;

  // Check warehouse exists (org-scoped)
  const warehouse = await WarehouseRepository.findByIdWithDetails(id, organizationId);
  if (!warehouse) {
    throw new NotFoundError('Warehouse');
  }

  // Check if warehouse has inventory
  const hasInventory = await WarehouseRepository.hasInventory(id);
  if (hasInventory) {
    throw new BusinessLogicError('Cannot delete warehouse with existing inventory. Please transfer or clear inventory first.');
  }

  // Soft delete (deactivate)
  await WarehouseRepository.deactivateWarehouse(id);

  res.json({ success: true, message: 'Warehouse deactivated successfully' });
});

// Get warehouse statistics
export const getWarehouseStats = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check warehouse exists
  const warehouse = await WarehouseRepository.findById(id);
  if (!warehouse) {
    throw new NotFoundError('Warehouse');
  }

  const stats = await WarehouseRepository.getWarehouseStats(id);

  const transformed = {
    id: stats.id,
    name: stats.name,
    capacity: stats.capacity,
    currentUtilization: stats.current_utilization,
    inventory: {
      totalItems: parseInt(stats.total_items) || 0,
      totalQuantity: parseInt(stats.total_quantity) || 0,
      availableQuantity: parseInt(stats.available_quantity) || 0,
      reservedQuantity: parseInt(stats.reserved_quantity) || 0,
      lowStockItems: parseInt(stats.low_stock_items) || 0
    },
    pickLists: {
      total: parseInt(stats.total_pick_lists) || 0,
      pending: parseInt(stats.pending_pick_lists) || 0,
      active: parseInt(stats.active_pick_lists) || 0,
      completed: parseInt(stats.completed_pick_lists) || 0
    }
  };

  res.json({ success: true, data: transformed });
});

// Get warehouse inventory
export const getWarehouseInventory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Use validatedQuery from middleware
  const queryParams = req.validatedQuery || req.query;

  // Check warehouse exists
  const warehouse = await WarehouseRepository.findById(id);
  if (!warehouse) {
    throw new NotFoundError('Warehouse');
  }

  const { page, limit, search, low_stock } = queryParams;

  const { items, totalCount } = await WarehouseRepository.getWarehouseInventory(
    id,
    { page, limit, search, low_stock }
  );

  res.json({
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CARRIERS
// ─────────────────────────────────────────────────────────────────────────────

/** Transform a carrier DB row into a consistent frontend shape. */
function formatCarrier(c) {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    serviceType: c.service_type || 'standard',
    serviceAreas: c.service_areas || [],
    status: c.is_active ? 'active' : 'inactive',
    availabilityStatus: c.availability_status || 'available',
    reliabilityScore: c.reliability_score ? parseFloat(c.reliability_score) : null,
    avgDeliveryDays: c.avg_delivery_days ? parseFloat(c.avg_delivery_days) : null,
    dailyCapacity: c.daily_capacity || null,
    activeShipments: parseInt(c.active_shipments) || 0,
    totalShipments: parseInt(c.total_shipments) || 0,
    onTimeRate: c.on_time_rate ? parseFloat(c.on_time_rate) : null,
    contactEmail: c.contact_email || null,
    contactPhone: c.contact_phone || null,
    website: c.website || null,
    apiEndpoint: c.api_endpoint || null,
    webhookUrl: c.webhook_url || null,
    webhook_secret: c.webhook_secret || null,
    organizationId: c.organization_id || null,
    createdAt: c.created_at,
    updatedAt: c.updated_at
  };
}

// GET /carriers
export const listCarriers = asyncHandler(async (req, res) => {
  const { is_active, availability_status, service_type, search, code, page = 1, limit = 50 } = req.query;
  const organizationId = req.orgContext?.organizationId;

  // If filtering by code, do a single lookup
  if (code) {
    const carrier = await CarrierRepository.findByCode(code, organizationId);
    if (!carrier) throw new NotFoundError('Carrier');
    return res.json({ success: true, data: [formatCarrier(carrier)] });
  }

  const { carriers, totalCount } = await CarrierRepository.findCarriers({
    page: parseInt(page),
    limit: parseInt(limit),
    is_active: is_active !== undefined ? is_active === 'true' : null,
    availability_status: availability_status || null,
    service_type: service_type || null,
    search: search || null,
    organizationId
  });

  res.json({
    success: true,
    data: carriers.map(formatCarrier),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount,
      totalPages: Math.ceil(totalCount / parseInt(limit))
    }
  });
});

// GET /carriers/:id
export const getCarrier = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;

  const carrier = await CarrierRepository.findByIdWithDetails(id, organizationId);
  if (!carrier) throw new NotFoundError('Carrier');

  res.json({ success: true, data: formatCarrier(carrier) });
});

// POST /carriers
export const createCarrier = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;

  // Validate code format (uppercase letters, numbers, hyphens)
  const code = (req.body.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{0,48}$/.test(code)) {
    throw new BusinessLogicError('Carrier code must be uppercase letters, numbers, and hyphens (e.g. DHL-001)');
  }

  // Check uniqueness within org scope
  const existing = await CarrierRepository.findByCode(code, organizationId);
  if (existing) throw new BusinessLogicError(`Carrier code '${code}' already exists`);

  const carrier = await CarrierRepository.createCarrier({
    ...req.body,
    code,
    organization_id: organizationId || req.body.organization_id || null
  });

  logger.info('Carrier created', {
    carrierId: carrier.id,
    code: carrier.code,
    userId: req.user?.userId
  });

  res.status(201).json({ success: true, data: formatCarrier(carrier) });
});

// PUT /carriers/:id
export const updateCarrier = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;

  const existing = await CarrierRepository.findByIdWithDetails(id, organizationId);
  if (!existing) throw new NotFoundError('Carrier');

  const carrier = await CarrierRepository.updateCarrier(id, req.body);

  logger.info('Carrier updated', { carrierId: id, userId: req.user?.userId });

  res.json({ success: true, data: formatCarrier(carrier) });
});

// DELETE /carriers/:id  (soft delete)
export const deleteCarrier = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;

  const existing = await CarrierRepository.findByIdWithDetails(id, organizationId);
  if (!existing) throw new NotFoundError('Carrier');

  const hasActive = await CarrierRepository.hasActiveShipments(id);
  if (hasActive) {
    throw new BusinessLogicError('Cannot deactivate carrier with active shipments. Reassign shipments first.');
  }

  await CarrierRepository.deactivateCarrier(id);

  logger.info('Carrier deactivated', { carrierId: id, userId: req.user?.userId });
  res.json({ success: true, message: 'Carrier deactivated successfully' });
});

// GET /carriers/:id/rate-cards
export const getCarrierRateCards = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;

  const carrier = await CarrierRepository.findByIdWithDetails(id, organizationId);
  if (!carrier) throw new NotFoundError('Carrier');

  const rateCards = await CarrierRepository.findRateCards(id);
  res.json({ success: true, data: rateCards });
});

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /products
export const listProducts = asyncHandler(async (req, res) => {
  const { category, is_active, search, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const organizationId = req.orgContext?.organizationId;

  let query = `
    SELECT p.*, COUNT(*) OVER() AS total_count
    FROM products p
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 1;

  if (organizationId) {
    query += ` AND (p.organization_id = $${paramCount++} OR p.organization_id IS NULL)`;
    params.push(organizationId);
  }

  if (category) {
    query += ` AND p.category = $${paramCount++}`;
    params.push(category);
  }

  if (is_active !== undefined) {
    query += ` AND p.is_active = $${paramCount++}`;
    params.push(is_active === 'true');
  }

  if (search) {
    query += ` AND (p.name ILIKE $${paramCount} OR p.sku ILIKE $${paramCount})`;
    params.push(`%${search}%`);
    paramCount++;
  }

  query += ` ORDER BY p.name ASC LIMIT $${paramCount++} OFFSET $${paramCount}`;
  params.push(parseInt(limit), offset);

  const result = await pool.query(query, params);
  const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

  res.json({
    success: true,
    data: result.rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount,
      totalPages: Math.ceil(totalCount / parseInt(limit))
    }
  });
});

// POST /products
export const createProduct = asyncHandler(async (req, res) => {
  let { sku, name, category, description, weight, dimensions, unit_price, cost_price, currency,
    is_fragile, requires_cold_storage, is_hazmat, is_perishable,
    item_type, package_type, handling_instructions, requires_insurance, declared_value,
    attributes } = req.body;
  const organizationId = req.orgContext?.organizationId;

  // Auto-generate SKU from product name if not supplied
  if (!sku) {
    const prefix = (name || 'ITEM')
      .replace(/[^A-Z0-9\s]/gi, '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.slice(0, 3).toUpperCase())
      .join('')
      .slice(0, 6) || 'PRD';

    const month = new Date().toISOString().slice(0, 7).replace('-', '');

    // Retry up to 5 times on collision
    for (let attempt = 0; attempt < 5; attempt++) {
      const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
      const candidate = `${prefix}-${month}-${rand}`;
      const { rows } = await pool.query(
        `SELECT 1 FROM products
         WHERE sku = $1 AND (organization_id = $2 OR organization_id IS NULL) LIMIT 1`,
        [candidate, organizationId || null]
      );
      if (rows.length === 0) { sku = candidate; break; }
    }
    // Guaranteed-unique fallback
    if (!sku) sku = `${prefix}-${Date.now()}`;
  }

  // Check SKU uniqueness within org
  const existing = await pool.query(
    `SELECT id FROM products WHERE sku = $1 AND (organization_id = $2 OR organization_id IS NULL) LIMIT 1`,
    [sku, organizationId || null]
  );
  if (existing.rows.length > 0) {
    throw new BusinessLogicError(`Product SKU '${sku}' already exists`);
  }

  const result = await pool.query(
    `INSERT INTO products (
       organization_id, sku, name, category, description, weight, dimensions,
       unit_price, cost_price, currency,
       is_fragile, requires_cold_storage, is_hazmat, is_perishable,
       item_type, package_type, handling_instructions,
       requires_insurance, declared_value, attributes, is_active
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,true) RETURNING *`,
    [
      organizationId || null,
      sku, name, category || null, description || null,
      weight || null,
      dimensions ? JSON.stringify(dimensions) : null,
      unit_price || null, cost_price || null, currency || 'INR',
      is_fragile || false, requires_cold_storage || false,
      is_hazmat || false, is_perishable || false,
      item_type || 'general', package_type || 'box',
      handling_instructions || null,
      requires_insurance || false, declared_value || null,
      attributes ? JSON.stringify(attributes) : null,
    ]
  );

  logger.info('Product created', { productId: result.rows[0].id, sku, userId: req.user?.userId });
  res.status(201).json({ success: true, data: result.rows[0] });
});

// PUT /products/:id
export const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;

  // Confirm product exists and belongs to org
  const existing = await pool.query(
    `SELECT id FROM products WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL) LIMIT 1`,
    [id, organizationId || null]
  );
  if (existing.rows.length === 0) throw new NotFoundError('Product');

  const {
    name, category, description, weight, dimensions,
    unit_price, cost_price, currency,
    is_fragile, requires_cold_storage, is_hazmat, is_perishable, is_active,
    item_type, package_type, handling_instructions,
    requires_insurance, declared_value,
    attributes, images
  } = req.body;

  const result = await pool.query(
    `UPDATE products SET
       name                  = COALESCE($1, name),
       category              = COALESCE($2, category),
       description           = COALESCE($3, description),
       weight                = COALESCE($4, weight),
       dimensions            = COALESCE($5, dimensions),
       unit_price            = COALESCE($6, unit_price),
       cost_price            = COALESCE($7, cost_price),
       currency              = COALESCE($8, currency),
       is_fragile            = COALESCE($9, is_fragile),
       requires_cold_storage = COALESCE($10, requires_cold_storage),
       is_hazmat             = COALESCE($11, is_hazmat),
       is_perishable         = COALESCE($12, is_perishable),
       is_active             = COALESCE($13, is_active),
       item_type             = COALESCE($14, item_type),
       package_type          = COALESCE($15, package_type),
       handling_instructions = COALESCE($16, handling_instructions),
       requires_insurance    = COALESCE($17, requires_insurance),
       declared_value        = COALESCE($18, declared_value),
       attributes            = COALESCE($19, attributes),
       images                = COALESCE($20, images),
       updated_at            = NOW()
     WHERE id = $21
     RETURNING *`,
    [
      name || null,
      category || null,
      description || null,
      weight !== undefined ? weight : null,
      dimensions ? JSON.stringify(dimensions) : null,
      unit_price !== undefined ? unit_price : null,
      cost_price !== undefined ? cost_price : null,
      currency || null,
      is_fragile !== undefined ? is_fragile : null,
      requires_cold_storage !== undefined ? requires_cold_storage : null,
      is_hazmat !== undefined ? is_hazmat : null,
      is_perishable !== undefined ? is_perishable : null,
      is_active !== undefined ? is_active : null,
      item_type || null,
      package_type || null,
      handling_instructions || null,
      requires_insurance !== undefined ? requires_insurance : null,
      declared_value !== undefined ? declared_value : null,
      attributes ? JSON.stringify(attributes) : null,
      images ? JSON.stringify(images) : null,
      id
    ]
  );

  logger.info('Product updated', { productId: id, userId: req.user?.userId });
  res.json({ success: true, data: result.rows[0] });
});

// DELETE /products/:id  (soft delete — sets is_active = false)
export const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;

  const existing = await pool.query(
    `SELECT id FROM products WHERE id = $1 AND (organization_id = $2 OR organization_id IS NULL) LIMIT 1`,
    [id, organizationId || null]
  );
  if (existing.rows.length === 0) throw new NotFoundError('Product');

  // Check if product is used in open inventory
  const inUse = await pool.query(
    `SELECT COUNT(*) AS cnt FROM inventory WHERE product_id = $1 AND quantity > 0 LIMIT 1`,
    [id]
  );
  if (parseInt(inUse.rows[0]?.cnt) > 0) {
    throw new BusinessLogicError('Cannot delete product with active inventory. Remove stock first.');
  }

  await pool.query(`DELETE FROM products WHERE id = $1`, [id]);

  logger.info('Product deleted', { productId: id, userId: req.user?.userId });
  res.json({ success: true, message: 'Product deleted successfully' });
});

// ─────────────────────────────────────────────────────────────────────────────
// SLA POLICIES
// ─────────────────────────────────────────────────────────────────────────────

// GET /sla-policies
export const listSlaPolicies = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  const params = [];
  let paramCount = 1;

  let query = `SELECT * FROM sla_policies WHERE is_active = true`;

  if (organizationId) {
    query += ` AND (organization_id = $${paramCount++} OR organization_id IS NULL)`;
    params.push(organizationId);
  }

  query += ` ORDER BY priority ASC, name ASC`;

  const result = await pool.query(query, params);

  const policies = result.rows.map(p => ({
    id: p.id,
    name: p.name,
    serviceType: p.service_type,
    originRegion: p.origin_region || null,
    destinationRegion: p.destination_region || null,
    targetDeliveryHours: p.delivery_hours,
    pickupHours: p.pickup_hours,
    penaltyPerHour: parseFloat(p.penalty_per_hour) || 0,
    maxPenaltyAmount: p.max_penalty_amount ? parseFloat(p.max_penalty_amount) : null,
    penaltyType: p.penalty_type || 'fixed',
    priority: p.priority,
    isActive: p.is_active,
    createdAt: p.created_at
  }));

  res.json({ success: true, data: policies });
});

// ─────────────────────────────────────────────────────────────────────────────
// RATE CARDS  (legacy compatibility — use CarrierRepository.findRateCards too)
// ─────────────────────────────────────────────────────────────────────────────

// GET /carriers/:carrierId/rate-cards  (legacy route in mdm.js)
export const listRateCards = asyncHandler(async (req, res) => {
  const { carrierId } = req.params;
  const rateCards = await CarrierRepository.findRateCards(carrierId);
  res.json({ success: true, data: rateCards });
});

