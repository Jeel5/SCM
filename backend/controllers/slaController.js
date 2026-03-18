// SLA Controller - handles service level agreements, ETAs, and violations
import slaRepo from '../repositories/SlaRepository.js';
import logger from '../utils/logger.js';
import { asyncHandler, NotFoundError } from '../errors/index.js';
import { emitToOrg } from '../sockets/emitter.js';
import { cacheWrap, orgSeg, invalidatePattern } from '../utils/cache.js';

// Map a sla_policies DB row to the API response shape
function mapPolicy(p) {
  return {
    id:                      p.id,
    name:                    p.name,
    serviceType:             p.service_type,
    carrierId:               p.carrier_id || null,
    carrierName:             p.carrier_name || null,
    originZoneType:          p.origin_zone_type || null,
    destinationZoneType:     p.destination_zone_type || null,
    // keep legacy 'region' field as a human-readable label
    region:                  p.origin_region || p.origin_zone_type || 'All Regions',
    targetDeliveryHours:     p.delivery_hours,
    warningThresholdPercent: p.warning_threshold_percent ?? 80,
    warningThresholdHours:   Math.floor(p.delivery_hours * ((p.warning_threshold_percent ?? 80) / 100)),
    penaltyAmount:           parseFloat(p.penalty_per_hour) || 0,
    maxPenaltyAmount:        p.max_penalty_amount ? parseFloat(p.max_penalty_amount) : null,
    penaltyType:             p.penalty_type || 'fixed',
    isActive:                p.is_active,
    priority:                p.priority,
    createdAt:               p.created_at,
  };
}

// Get list of active SLA policies — cached 10 minutes (rarely changes)
export const listSlaPolicies = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  const data = await cacheWrap(`sla:pol:${orgSeg(organizationId)}`, 600, async () => {
    const rows = await slaRepo.findActivePolicies(organizationId);
    return rows.map(mapPolicy);
  });
  res.json({ success: true, data });
});

// Create a new SLA policy
export const createSlaPolicy = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  const data = req.body;

  const row = await slaRepo.createPolicy({ organizationId, ...data });
  logger.info('SLA policy created', { policyId: row.id, name: row.name, userId: req.user?.userId });
  // Invalidate policy list cache for this org and global scope
  await invalidatePattern('sla:pol:*');
  res.status(201).json({ success: true, data: mapPolicy(row) });
});

// Update an existing SLA policy
export const updateSlaPolicy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;
  const data = req.body;

  const row = await slaRepo.updatePolicy(id, data, organizationId);
  if (!row) throw new NotFoundError('SLA Policy');

  logger.info('SLA policy updated', { policyId: id, userId: req.user?.userId });
  await invalidatePattern('sla:pol:*');
  res.json({ success: true, data: mapPolicy(row) });
});

// Deactivate (soft-delete) an SLA policy
export const deactivateSlaPolicy = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;

  const row = await slaRepo.deactivatePolicy(id, organizationId);
  if (!row) throw new NotFoundError('SLA Policy');

  await invalidatePattern('sla:pol:*');
  res.json({ success: true, message: 'Policy deactivated' });
});

export const getEta = asyncHandler(async (req, res) => {
  const { shipmentId } = req.params;
  // Use injectOrgContext result — consistent with all other handlers (T3-06)
  const organizationId = req.orgContext?.organizationId;

  const eta = await slaRepo.findLatestEta(shipmentId, organizationId);

  if (!eta) throw new NotFoundError('ETA');

  res.json({
    success: true,
    data: {
      shipmentId: eta.shipment_id,
      trackingNumber: eta.tracking_number,
      predictedEta: eta.predicted_delivery,
      confidenceScore: parseFloat(eta.confidence_score || 0),
      factors: eta.factors,
      mlModel: eta.model_version,
      predictedAt: eta.created_at
    }
  });
});

export const getSlaViolations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.validatedQuery || req.query;
  const pageNum  = parseInt(page)  || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  // Use injectOrgContext result — consistent with all other handlers (T3-06)
  const organizationId = req.orgContext?.organizationId;

  const { rows, total } = await slaRepo.findViolations({
    organizationId, status, page: pageNum, limit: limitNum,
  });

  res.json({
    success: true,
    data: rows.map(v => ({
      id: v.id,
      shipmentId: v.shipment_id,
      trackingNumber: v.tracking_number,
      policyId: v.sla_policy_id,
      policyName: v.policy_name,
      expectedDelivery: v.promised_delivery,
      actualDelivery: v.actual_delivery,
      delayHours: parseFloat(v.delay_hours),
      status: v.status,
      penaltyAmount: parseFloat(v.penalty_amount),
      carrierId: v.carrier_id,
      rootCause: v.reason,
      notes: v.notes,
      violatedAt: v.violated_at,
      resolvedAt: v.resolved_at,
      createdAt: v.created_at,
    })),
    pagination: { page: pageNum, limit: limitNum, total }
  });
});

export const getSlaDashboard = asyncHandler(async (req, res) => {
  // Use injectOrgContext result — consistent with all other handlers (T3-06)
  const organizationId = req.orgContext?.organizationId;

  const { compliance, violations, carriers } = await slaRepo.getSlaDashboard(organizationId);

  const onTimeRate = compliance.total_shipments > 0
    ? (parseInt(compliance.on_time) / parseInt(compliance.total_shipments) * 100).toFixed(1)
    : 0;

  res.json({
    success: true,
    data: {
      overallCompliance: parseFloat(onTimeRate),
      totalShipments: parseInt(compliance.total_shipments),
      onTimeDeliveries: parseInt(compliance.on_time),
      violations: violations.reduce((acc, v) => {
        // Map DB status 'open' to 'pending' to match frontend type key
        const key = v.status === 'open' ? 'pending' : v.status;
        acc[key] = parseInt(v.count);
        return acc;
      }, { pending: 0, resolved: 0, waived: 0 }),
      topCarriers: carriers.map(c => ({
        name: c.name,
        reliabilityScore: parseFloat(c.reliability_score),
        shipmentCount: parseInt(c.shipment_count)
      }))
    }
  });
});

export const listExceptions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, severity, status } = req.validatedQuery || req.query;
  const pageNum  = parseInt(page)  || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  const organizationId = req.orgContext?.organizationId;

  const { rows, total } = await slaRepo.findExceptions({
    organizationId, severity, status, page: pageNum, limit: limitNum,
  });
  const statsRow = await slaRepo.getExceptionStatusStats({ organizationId });

  res.json({
    success: true,
    stats: {
      totalExceptions: parseInt(statsRow.total_exceptions || 0),
      open: parseInt(statsRow.open || 0),
      inProgress: parseInt(statsRow.in_progress || 0),
      resolved: parseInt(statsRow.resolved || 0),
      critical: parseInt(statsRow.critical || 0),
    },
    data: rows.map(e => ({
      id: e.id,
      shipmentId: e.shipment_id,
      trackingNumber: e.tracking_number,
      orderId: e.order_id,
      orderNumber: e.order_number,
      type: e.exception_type,
      severity: e.severity,
      status: e.status,
      title: e.title,
      description: e.description,
      rootCause: e.root_cause,
      resolution: e.resolution,
      assignedTo: e.assigned_to,
      slaImpact: e.sla_impacted,
      estimatedResolutionTime: e.estimated_resolution_time,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
      resolvedAt: e.resolved_at
    })),
    pagination: { page: pageNum, limit: limitNum, total }
  });
});

export const createException = asyncHandler(async (req, res) => {
  const { shipmentId, type: exceptionType, severity, description } = req.body;
  const organizationId = req.orgContext?.organizationId;

  const row = await slaRepo.createException({ organizationId, shipmentId, exceptionType, severity, description });

  emitToOrg(organizationId, 'exception:created', row);

  res.status(201).json({ success: true, data: row });
});

export const getException = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.orgContext?.organizationId;

  const e = await slaRepo.findExceptionById(id, organizationId);
  if (!e) throw new NotFoundError('Exception');

  res.json({
    success: true,
    data: {
      id: e.id,
      shipmentId: e.shipment_id,
      trackingNumber: e.tracking_number,
      orderId: e.order_id,
      orderNumber: e.order_number,
      type: e.exception_type,
      severity: e.severity,
      status: e.status,
      title: e.title,
      description: e.description,
      rootCause: e.root_cause,
      resolution: e.resolution,
      assignedTo: e.assigned_to,
      slaImpact: e.sla_impacted,
      estimatedResolutionTime: e.estimated_resolution_time,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
      resolvedAt: e.resolved_at,
    }
  });
});

export const resolveException = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { resolution } = req.body;
  // Use injectOrgContext result — consistent with all other handlers (T3-06)
  const organizationId = req.orgContext?.organizationId;

  const row = await slaRepo.resolveException(id, resolution, organizationId);

  if (!row) throw new NotFoundError('Exception');

  emitToOrg(organizationId, 'exception:resolved', row);

  res.json({ success: true, data: row });
});

