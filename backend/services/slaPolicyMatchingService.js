/**
 * SLA Policy Matching Service
 *
 * When a shipment is created this service:
 *  1. Queries the org's active SLA policies for the best match
 *     (carrier → service-type specificity ranking)
 *  2. Derives delivery_scheduled = NOW() + policy.delivery_hours
 */

import slaRepository from '../repositories/SlaRepository.js';
import logger from '../utils/logger.js';

// ─── Service Type Normalisation ───────────────────────────────────────────────

/**
 * DB CHECK for sla_policies.service_type:
 *   same_day | express | standard | economy | bulk
 */
const SERVICE_MAP = {
  same_day:        'same_day',
  sameday:         'same_day',
  same_day_delivery: 'same_day',
  express:         'express',
  priority:        'express',
  overnight:       'express',
  nextday:         'express',
  next_day:        'express',
  standard:        'standard',
  regular:         'standard',
  ground:          'standard',
  economy:         'economy',
  economy_express: 'economy',
  surface:         'economy',
  slow:            'economy',
  bulk:            'bulk',
  heavy:           'bulk',
  freight:         'bulk',
};

/**
 * Normalise a raw service type string to a DB-valid value, or null.
 */
export function normalizeServiceType(raw) {
  if (!raw) return null;
  return SERVICE_MAP[String(raw).toLowerCase().replace(/[\s-]/g, '_')] ?? null;
}

// ─── Core Matching Function ───────────────────────────────────────────────────

/**
 * Match the best active SLA policy for a shipment being created.
 *
 * Matching rules (all are "OR NULL" – a policy with NULL in a field is a wildcard):
 *   - carrier_id      must match OR be NULL
 *   - service_type    must match OR be NULL
 *   - organization_id must match OR be NULL (NULL = system-wide policy)
 *
 * Tie-breaking (more specific wins):
 *   1. priority ASC (lower number = higher priority)
 *   2. carrier_id IS NOT NULL (carrier-specific policies win over generic)
 *   3. service_type IS NOT NULL
 *
 * @param {object} params
 * @param {string}        params.organizationId
 * @param {string|null}   params.carrierId           UUID of the carrier
 * @param {string|null}   params.serviceType         Raw service type (will be normalised)
 * @param {object}        [params.client]            Optional DB transaction client
 *
 * @returns {Promise<{
 *   policy: object|null,
 *   policyId: string|null,
 *   deliveryHours: number,
 *   pickupHours: number,
 *   deliveryScheduled: Date,
 *   pickupDeadline: Date,
 *   matchedBy: string,
 * }>}
 */
export async function matchSlaPolicyForShipment({
  organizationId,
  carrierId,
  serviceType,
  client,
}) {
  const normService     = normalizeServiceType(serviceType);

  logger.debug('SLA policy matching — inputs', {
    organizationId,
    carrierId: carrierId || null,
    normService,
  });

  const policy = await slaRepository.findMatchingPolicy({
    organizationId,
    carrierId:        carrierId   || null,
    serviceType:      normService || null,
    client,
  });

  if (!policy) {
     throw new Error('No SLA policy matched for shipment');
  }
  
  const deliveryHours = policy.delivery_hours;
  const pickupHours   = policy.pickup_hours;

  const now               = new Date();
  const deliveryScheduled = new Date(now.getTime() + deliveryHours * 3_600_000);
  const pickupDeadline    = new Date(now.getTime() + pickupHours   * 3_600_000);

  const matchedBy = `policy:${policy.id} "${policy.name}" (${deliveryHours}h delivery)`;

  logger.info('SLA policy matched', {
    organizationId,
    policyId:   policy?.id   || null,
    policyName: policy?.name || null,
    deliveryHours,
    matchedBy,
  });

  return {
    policy:            policy || null,
    policyId:          policy?.id || null,
    deliveryHours,
    pickupHours,
    deliveryScheduled,
    pickupDeadline,
    matchedBy,
  };
}

export default { matchSlaPolicyForShipment, normalizeServiceType };
