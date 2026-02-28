// SLA Controller - handles service level agreements, ETAs, and violations
import slaRepo from '../repositories/SlaRepository.js';
import logger from '../utils/logger.js';
import { asyncHandler, NotFoundError } from '../errors/index.js';

// Get list of active SLA policies
export const listSlaPolicies = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  const rows = await slaRepo.findActivePolicies(organizationId);

  const policies = rows.map(p => ({
    id: p.id,
    name: p.name,
    serviceType: p.service_type,
    region: p.origin_region || 'All Regions',
    targetDeliveryHours: p.delivery_hours,
    warningThresholdHours: Math.floor(p.delivery_hours * 0.8),
    penaltyAmount: parseFloat(p.penalty_per_hour) || 10,
    penaltyType: 'fixed',
    isActive: p.is_active,
    createdAt: p.created_at
  }));

  res.json({ success: true, data: policies });
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
      predictedEta: eta.predicted_eta,
      confidenceScore: parseFloat(eta.confidence_score),
      factors: eta.factors,
      mlModel: eta.ml_model,
      predictedAt: eta.predicted_at
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
      status: v.status,
      violationReason: v.reason,
      penaltyAmount: parseFloat(v.penalty_amount),
      violatedAt: v.violated_at,
      resolvedAt: v.resolved_at
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
    : 100;

  res.json({
    success: true,
    data: {
      overallCompliance: parseFloat(onTimeRate),
      totalShipments: parseInt(compliance.total_shipments),
      onTimeDeliveries: parseInt(compliance.on_time),
      violations: violations.reduce((acc, v) => {
        acc[v.status] = parseInt(v.count);
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

  res.json({
    success: true,
    data: rows.map(e => ({
      id: e.id,
      shipmentId: e.shipment_id,
      trackingNumber: e.tracking_number,
      orderNumber: e.order_number,
      exceptionType: e.exception_type,
      severity: e.severity,
      description: e.description,
      status: e.status,
      resolution: e.resolution,
      createdAt: e.created_at,
      resolvedAt: e.resolved_at
    })),
    pagination: { page: pageNum, limit: limitNum, total }
  });
});

export const createException = asyncHandler(async (req, res) => {
  const { shipmentId, exceptionType, severity, description } = req.body;
  const organizationId = req.orgContext?.organizationId;

  const row = await slaRepo.createException({ organizationId, shipmentId, exceptionType, severity, description });

  res.status(201).json({ success: true, data: row });
});

export const resolveException = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { resolution } = req.body;
  // Use injectOrgContext result — consistent with all other handlers (T3-06)
  const organizationId = req.orgContext?.organizationId;

  const row = await slaRepo.resolveException(id, resolution, organizationId);

  if (!row) throw new NotFoundError('Exception');

  res.json({ success: true, data: row });
});

