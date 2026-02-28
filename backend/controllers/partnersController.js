// Channel Partners Controller — Sales Channels & Suppliers CRUD
import SalesChannelRepo from '../repositories/SalesChannelRepository.js';
import SupplierRepo from '../repositories/SupplierRepository.js';
import { asyncHandler } from '../errors/errorHandler.js';
import { NotFoundError, BusinessLogicError } from '../errors/index.js';
import logger from '../utils/logger.js';

// ==================== SALES CHANNELS ====================

export const listChannels = asyncHandler(async (req, res) => {
  const queryParams = req.validatedQuery || req.query;
  const organizationId = req.orgContext?.organizationId;

  const { channels, totalCount } = await SalesChannelRepo.findChannels({
    ...queryParams,
    organizationId,
  });

  res.json({
    success: true,
    data: channels,
    pagination: {
      page: queryParams.page || 1,
      limit: queryParams.limit || 50,
      total: totalCount,
      totalPages: Math.ceil(totalCount / (queryParams.limit || 50)),
    },
  });
});

export const getChannel = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  const channel = await SalesChannelRepo.findByIdScoped(req.params.id, organizationId);
  if (!channel) throw new NotFoundError('Sales Channel');
  res.json({ success: true, data: channel });
});

/** Generate a unique code from the name, e.g. 'Croma India' → 'CROMA-INDIA', appending a random suffix if needed. */
function generateCode(name) {
  const base = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 40);
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

export const createChannel = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;

  // Auto-generate code from name
  const code = generateCode(req.body.name);

  const channel = await SalesChannelRepo.createChannel({
    ...req.body,
    code,
    organization_id: organizationId,
  });

  logger.info('Sales channel created', { channelId: channel.id, code: channel.code, orgId: organizationId });
  res.status(201).json({ success: true, data: channel });
});

export const updateChannel = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;

  // Strip code from update payload — code is auto-generated
  const { code: _ignored, ...updateData } = req.body;

  const channel = await SalesChannelRepo.updateChannel(req.params.id, organizationId, updateData);
  if (!channel) throw new NotFoundError('Sales Channel');

  logger.info('Sales channel updated', { channelId: channel.id, orgId: organizationId });
  res.json({ success: true, data: channel });
});

export const deleteChannel = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  const channel = await SalesChannelRepo.deleteChannel(req.params.id, organizationId);
  if (!channel) throw new NotFoundError('Sales Channel');

  logger.info('Sales channel deleted', { channelId: channel.id, orgId: organizationId });
  res.json({ success: true, message: 'Sales channel deleted' });
});

// ==================== SUPPLIERS ====================

export const listSuppliers = asyncHandler(async (req, res) => {
  const queryParams = req.validatedQuery || req.query;
  const organizationId = req.orgContext?.organizationId;

  const { suppliers, totalCount } = await SupplierRepo.findSuppliers({
    ...queryParams,
    organizationId,
  });

  res.json({
    success: true,
    data: suppliers,
    pagination: {
      page: queryParams.page || 1,
      limit: queryParams.limit || 50,
      total: totalCount,
      totalPages: Math.ceil(totalCount / (queryParams.limit || 50)),
    },
  });
});

export const getSupplier = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  const supplier = await SupplierRepo.findByIdScoped(req.params.id, organizationId);
  if (!supplier) throw new NotFoundError('Supplier');
  res.json({ success: true, data: supplier });
});

export const createSupplier = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;

  // Auto-generate code from name
  const code = generateCode(req.body.name);

  const supplier = await SupplierRepo.createSupplier({
    ...req.body,
    code,
    organization_id: organizationId,
  });

  logger.info('Supplier created', { supplierId: supplier.id, code: supplier.code, orgId: organizationId });
  res.status(201).json({ success: true, data: supplier });
});

export const updateSupplier = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;

  // Strip code from update payload — code is auto-generated
  const { code: _ignored, ...updateData } = req.body;

  const supplier = await SupplierRepo.updateSupplier(req.params.id, organizationId, updateData);
  if (!supplier) throw new NotFoundError('Supplier');

  logger.info('Supplier updated', { supplierId: supplier.id, orgId: organizationId });
  res.json({ success: true, data: supplier });
});

export const deleteSupplier = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  const supplier = await SupplierRepo.deleteSupplier(req.params.id, organizationId);
  if (!supplier) throw new NotFoundError('Supplier');

  logger.info('Supplier deleted', { supplierId: supplier.id, orgId: organizationId });
  res.json({ success: true, message: 'Supplier deleted' });
});
