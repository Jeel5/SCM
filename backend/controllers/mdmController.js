// Master Data Management (MDM) Controller
// Handles warehouses, carriers, products, SLA policies, and rate cards.
import WarehouseRepository from '../repositories/WarehouseRepository.js';
import CarrierRepository from '../repositories/CarrierRepository.js';
import SlaRepository from '../repositories/SlaRepository.js';
import ProductRepository from '../repositories/ProductRepository.js';
import { asyncHandler } from '../errors/errorHandler.js';
import { NotFoundError, BusinessLogicError } from '../errors/index.js';
import logger from '../utils/logger.js';
import { generateInternalBarcode } from '../utils/barcodeGenerator.js';

/**
 * Normalize warehouse address payload for API responses.
 * @param {Object} address
 * @returns {{street: string, city: string, state: string, postalCode: string, country: string}}
 */
function mapWarehouseAddress(address) {
  return {
    street: address?.street || '',
    city: address?.city || '',
    state: address?.state || '',
    postalCode: address?.postal_code || address?.postalCode || '',
    country: address?.country || 'India',
  };
}

/**
 * Map warehouse-specific SCM extension fields to frontend shape.
 * @param {Object} warehouse
 * @returns {Object}
 */
function mapWarehouseScmFields(warehouse) {
  return {
    gstin: warehouse.gstin || null,
    hasColdStorage: warehouse.has_cold_storage || false,
    temperatureMinCelsius: warehouse.temperature_min_celsius !== null ? parseFloat(warehouse.temperature_min_celsius) : null,
    temperatureMaxCelsius: warehouse.temperature_max_celsius !== null ? parseFloat(warehouse.temperature_max_celsius) : null,
    dailyInboundCapacity: undefined,
    dailyOutboundCapacity: undefined,
    customsBondedWarehouse: warehouse.customs_bonded_warehouse || false,
    certifications: warehouse.certifications || [],
  };
}

/**
 * Build the canonical warehouse payload returned by warehouse endpoints.
 * This removes duplicate object construction across list/get/create/update handlers.
 * @param {Object} warehouse
 * @param {Object} [options]
 * @param {number|null} [options.totalQty]
 * @param {number|null} [options.inventoryCount]
 * @returns {Object}
 */
function formatWarehouseResponse(warehouse, options = {}) {
  const capacity = warehouse.capacity || 0;
  const totalQty = options.totalQty ?? warehouse.current_utilization ?? 0;
  const inventoryCount = options.inventoryCount ?? warehouse.inventory_count ?? 0;
  const utilizationPercentage = capacity > 0
    ? Math.min(parseFloat(((totalQty / capacity) * 100).toFixed(1)), 100)
    : 0;

  return {
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    type: warehouse.warehouse_type,
    address: mapWarehouseAddress(warehouse.address),
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
    ...mapWarehouseScmFields(warehouse),
    createdAt: warehouse.created_at,
    updatedAt: warehouse.updated_at,
  };
}

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
  const inventoryCounts = {};
  const warehouseQtys = {};

  if (warehouseIds.length > 0) {
    const statsByWarehouse = await WarehouseRepository.getInventoryStatsBatch(warehouseIds);
    Object.entries(statsByWarehouse).forEach(([wId, st]) => {
      inventoryCounts[wId] = st.inventory_count;
      warehouseQtys[wId]   = st.total_qty;
    });
  }

  const transformedWarehouses = warehouses.map(w => formatWarehouseResponse(w, {
    totalQty: warehouseQtys[w.id] || 0,
    inventoryCount: inventoryCounts[w.id] || 0,
  }));

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
  const warehouseStats = await WarehouseRepository.getInventoryStats(id);
  const inventoryCount = warehouseStats.inventory_count;
  const totalQty       = warehouseStats.total_qty;
  const capacity = warehouse.capacity || 0;
  const utilizationPercentage = capacity > 0 ? Math.min(parseFloat(((totalQty / capacity) * 100).toFixed(1)), 100) : 0;

  const transformed = formatWarehouseResponse(warehouse, {
    totalQty,
    inventoryCount,
  });

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

  const transformed = formatWarehouseResponse(warehouse, {
    totalQty: warehouse.current_utilization,
  });

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

  const transformed = formatWarehouseResponse(warehouse, {
    totalQty: warehouse.current_utilization,
  });

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
      totalItems: parseInt(stats.total_items, 10) || 0,
      totalQuantity: parseInt(stats.total_quantity, 10) || 0,
      availableQuantity: parseInt(stats.available_quantity, 10) || 0,
      reservedQuantity: parseInt(stats.reserved_quantity, 10) || 0,
      lowStockItems: parseInt(stats.low_stock_items, 10) || 0
    },
    pickLists: {
      total: parseInt(stats.total_pick_lists, 10) || 0,
      pending: parseInt(stats.pending_pick_lists, 10) || 0,
      active: parseInt(stats.active_pick_lists, 10) || 0,
      completed: parseInt(stats.completed_pick_lists, 10) || 0
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
  const effectiveStatus = !c.is_active
    ? 'inactive'
    : (c.availability_status === 'suspended' ? 'suspended' : 'active');

  return {
    id: c.id,
    code: c.code,
    name: c.name,
    serviceType: c.service_type || 'standard',
    serviceAreas: c.service_areas || [],
    status: effectiveStatus,
    availabilityStatus: c.availability_status || 'available',
    reliabilityScore: c.reliability_score ? parseFloat(c.reliability_score) : null,
    avgDeliveryDays: c.avg_delivery_days ? parseFloat(c.avg_delivery_days) : null,
    dailyCapacity: c.daily_capacity || null,
    activeShipments: parseInt(c.active_shipments, 10) || 0,
    totalShipments: parseInt(c.total_shipments, 10) || 0,
    onTimeRate: c.on_time_rate ? parseFloat(c.on_time_rate) : null,
    contactEmail: c.contact_email || null,
    contactPhone: c.contact_phone || null,
    website: c.website || null,
    apiEndpoint: c.api_endpoint || null,
    webhookUrl: c.webhook_url || null,
    webhookSecret: c.webhook_secret || null,
    webhookEnabled: c.webhook_enabled ?? true,
    organizationId: c.organization_id || null,
    createdAt: c.created_at,
    updatedAt: c.updated_at
  };
}

// GET /carriers
export const listCarriers = asyncHandler(async (req, res) => {
  const { is_active, availability_status, service_type, search, code, page = 1, limit = 50 } = req.query;
  const organizationId = req.orgContext?.organizationId || req.user?.organizationId;

  // If filtering by code, do a single lookup
  if (code) {
    const carrier = await CarrierRepository.findByCode(code, organizationId);
    if (!carrier) throw new NotFoundError('Carrier');
    return res.json({ success: true, data: [formatCarrier(carrier)] });
  }

  const { carriers, totalCount } = await CarrierRepository.findCarriers({
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
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
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total: totalCount,
      totalPages: Math.ceil(totalCount / parseInt(limit, 10))
    }
  });
});

// GET /carriers/:id
export const getCarrier = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId || req.user?.organizationId;

  const carrier = await CarrierRepository.findByIdWithDetails(id, organizationId);
  if (!carrier) throw new NotFoundError('Carrier');

  res.json({ success: true, data: formatCarrier(carrier) });
});

// POST /carriers
export const createCarrier = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId || req.user?.organizationId;
  const payload = { ...req.body };

  // Support frontend status field: active | inactive | suspended
  if (payload.status === 'inactive') {
    payload.is_active = false;
    payload.availability_status = 'offline';
  } else if (payload.status === 'suspended') {
    payload.is_active = true;
    payload.availability_status = 'suspended';
  } else if (payload.status === 'active') {
    payload.is_active = true;
    payload.availability_status = 'available';
  }

  // Use provided code or auto-generate one from the sequence
  let code;
  if (req.body.code && req.body.code.trim()) {
    code = req.body.code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{0,48}$/.test(code)) {
      throw new BusinessLogicError('Carrier code must be uppercase letters, numbers, and hyphens (e.g. DHL-001)');
    }
  } else {
    code = await CarrierRepository.generateCarrierCode();
  }

  // Check uniqueness within org scope
  const existing = await CarrierRepository.findByCode(code, organizationId);
  if (existing) throw new BusinessLogicError(`Carrier code '${code}' already exists`);

  const carrier = await CarrierRepository.createCarrier({
    ...payload,
    code,
    organization_id: organizationId || payload.organization_id || null
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
  const organizationId = req.orgContext?.organizationId || req.user?.organizationId;
  const payload = { ...req.body };

  if (payload.status === 'inactive') {
    payload.is_active = false;
    payload.availability_status = 'offline';
  } else if (payload.status === 'suspended') {
    payload.is_active = true;
    payload.availability_status = 'suspended';
  } else if (payload.status === 'active') {
    payload.is_active = true;
    payload.availability_status = 'available';
  }

  const existing = await CarrierRepository.findByIdWithDetails(id, organizationId);
  if (!existing) throw new NotFoundError('Carrier');

  const carrier = await CarrierRepository.updateCarrier(id, payload);

  logger.info('Carrier updated', { carrierId: id, userId: req.user?.userId });

  res.json({ success: true, data: formatCarrier(carrier) });
});

// DELETE /carriers/:id  (soft delete)
export const deleteCarrier = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId || req.user?.organizationId;

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
  const organizationId = req.orgContext?.organizationId || req.user?.organizationId;

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
  const limitNum  = parseInt(limit, 10);
  const offset    = (parseInt(page, 10) - 1) * limitNum;
  const organizationId = req.orgContext?.organizationId;

  const rows = await ProductRepository.findProducts({
    organizationId,
    search,
    category,
    is_active: is_active !== undefined ? is_active === 'true' : undefined,
    limit: limitNum,
    offset,
  });
  const statsRow = await ProductRepository.getProductStats({ organizationId });

  const totalCount = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  res.json({
    success: true,
    stats: {
      totalProducts: parseInt(statsRow.total_products || 0, 10),
      active: parseInt(statsRow.active_products || 0, 10),
      inactive: parseInt(statsRow.inactive_products || 0, 10),
      categories: parseInt(statsRow.category_count || 0, 10),
    },
    data: rows,
    pagination: {
      page: parseInt(page, 10),
      limit: limitNum,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limitNum)
    }
  });
});

// POST /products
export const createProduct = asyncHandler(async (req, res) => {
  let { sku, name, category, description, weight, dimensions, selling_price, cost_price, mrp, currency,
    is_fragile, requires_cold_storage, is_hazmat, is_perishable,
    package_type, handling_instructions, requires_insurance,
    attributes,
    manufacturer_barcode, hsn_code, gst_rate, brand, country_of_origin,
    warranty_period_days, shelf_life_days, tags, supplier_id } = req.body;
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
    const findAvailableSku = async (attempt = 0) => {
      if (attempt >= 5) return null;
      const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
      const candidate = `${prefix}-${month}-${rand}`;
      const collision = await ProductRepository.findBySku(candidate, organizationId);
      if (!collision) return candidate;
      return findAvailableSku(attempt + 1);
    };

    sku = await findAvailableSku();
    // Guaranteed-unique fallback
    if (!sku) sku = `${prefix}-${Date.now()}`;
  }

  // Check SKU uniqueness within org
  const existing = await ProductRepository.findBySku(sku, organizationId);
  if (existing) throw new BusinessLogicError(`Product SKU '${sku}' already exists`);

  // Auto-generate internal_barcode (globally unique warehouse barcode)
  const internal_barcode = generateInternalBarcode();

  const product = await ProductRepository.create({
    organization_id: organizationId,
    sku, name, category, description, weight, dimensions,
    selling_price, cost_price, mrp, currency,
    is_fragile, requires_cold_storage, is_hazmat, is_perishable,
    package_type, handling_instructions,
    requires_insurance, attributes,
    manufacturer_barcode, internal_barcode, hsn_code, gst_rate, brand, country_of_origin,
    warranty_period_days, shelf_life_days, tags, supplier_id,
  });

  logger.info('Product created', { productId: product.id, sku, internal_barcode, userId: req.user?.userId });
  res.status(201).json({ success: true, data: product });
});

// PUT /products/:id
export const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;

  // Confirm product exists and belongs to org
  const existing = await ProductRepository.findById(id, organizationId);
  if (!existing) throw new NotFoundError('Product');

  const updated = await ProductRepository.update(id, req.body);
  logger.info('Product updated', { productId: id, userId: req.user?.userId });
  res.json({ success: true, data: updated });
});

// DELETE /products/:id  (hard delete — caller must remove stock first)
export const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;

  const existing = await ProductRepository.findById(id, organizationId);
  if (!existing) throw new NotFoundError('Product');

  // Check if product is used in open inventory
  if (await ProductRepository.isInUse(id)) {
    throw new BusinessLogicError('Cannot delete product with active inventory. Remove stock first.');
  }

  await ProductRepository.delete(id);

  logger.info('Product deleted', { productId: id, userId: req.user?.userId });
  res.json({ success: true, message: 'Product deleted successfully' });
});

// ─────────────────────────────────────────────────────────────────────────────
// SLA POLICIES
// ─────────────────────────────────────────────────────────────────────────────

// GET /sla-policies
export const listSlaPolicies = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  const rows = await SlaRepository.findActivePolicies(organizationId);

  const policies = rows.map(p => ({
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

