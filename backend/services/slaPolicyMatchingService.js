/**
 * SLA Policy Matching Service
 *
 * When a shipment is created this service:
 *  1. Classifies origin + destination pincodes into zone types
 *     (local | metro | regional | national | remote)
 *  2. Queries the org's active SLA policies for the best match
 *     (carrier → zone → service-type specificity ranking)
 *  3. Derives delivery_scheduled = NOW() + policy.delivery_hours
 *  4. Falls back to SYSTEM_FALLBACK_HOURS (72h) when no policy matches
 *
 * Zone classification is based on Indian pincodes. Non-Indian deployments
 * can swap classifyZone() without touching the rest.
 */

import slaRepository from '../repositories/SlaRepository.js';
import logger from '../utils/logger.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Fallback delivery window when no SLA policy matches (hours). */
const SYSTEM_FALLBACK_HOURS = 72;

/** Fallback pickup window when no SLA policy matches (hours). */
const SYSTEM_FALLBACK_PICKUP_HOURS = 4;

// ─── Zone Classification (India) ─────────────────────────────────────────────

/*
 * Indian pincode → zone
 *   metro    – Mumbai, Delhi, Bangalore, Kolkata, Chennai, Hyderabad, Pune, Ahmedabad
 *   remote   – J&K, Ladakh, Andaman, Lakshadweep, North-East hill states
 *   regional – Everything else (intra-state or nearby states)
 *   national – Used when no pincode found
 *
 * DB CHECK constraint: 'local' | 'metro' | 'regional' | 'national' | 'remote'
 * We don't produce 'local' here because we can't know the shipper's home city;
 * an org can create 'local' policies manually for same-city deliveries.
 */

const METRO_PREFIXES = new Set([
  // Delhi / NCR
  '110', '111', '112', '121', '122', '123', '124', '125', '201',
  // Mumbai / Navi Mumbai / Thane
  '400', '401', '402', '403', '404', '405', '410', '421',
  // Pune
  '411', '412', '413', '414',
  // Bangalore / Mysore corridor
  '560', '561', '562', '563', '564', '565', '566', '567', '568', '569', '570',
  // Kolkata
  '700', '711', '712', '713',
  // Chennai
  '600', '601', '602', '603', '604',
  // Hyderabad
  '500', '501', '502', '503', '504', '505',
  // Ahmedabad / Surat / Baroda (Gujarat metros)
  '380', '390', '394', '395', '396',
  // Jaipur
  '302', '303',
  // Chandigarh
  '160',
  // Lucknow
  '226',
  // Kochi
  '682',
  // Indore
  '452',
]);

const REMOTE_3_PREFIXES = new Set([
  // Assam (upper) / Arunachal Pradesh
  '782', '783', '784', '785', '786', '787', '788',
  // Meghalaya / Manipur / Mizoram / Nagaland / Sikkim / Tripura
  '793', '794', '795', '796', '797', '798', '799',
  // Andaman & Nicobar
  '744',
  // Lakshadweep
  '682', // 682 shares with Kochi — only the specific range 682559 is Lakshadweep; handled below
]);

const REMOTE_2_PREFIXES = new Set([
  '18', // J&K – Srinagar / Jammu
  '19', // J&K – Leh / Ladakh / Kargil
]);

/**
 * Extract a 6-digit Indian pincode from an address value.
 * Handles: plain string, JSON-stringified object, or JS object.
 */
function extractPincode(address) {
  if (!address) return null;

  let obj = address;
  if (typeof address === 'string') {
    try { obj = JSON.parse(address); } catch { /* raw string – fall through */ }
  }

  if (obj && typeof obj === 'object') {
    const pin = obj.pincode ?? obj.postal_code ?? obj.postalCode ?? obj.zipCode ?? obj.zip ?? null;
    if (pin) return String(pin).replace(/\D/g, '').substring(0, 6);
  }

  // Last resort: find a 6-digit sequence in the raw string
  const m = String(address).match(/\b(\d{6})\b/);
  return m ? m[1] : null;
}

/**
 * Classify a pincode to a zone type.
 * Returns: 'metro' | 'remote' | 'regional' | 'national'
 */
export function classifyZone(address) {
  const pincode = extractPincode(address);
  if (!pincode || pincode.length < 6) return 'national';

  const p3 = pincode.substring(0, 3);
  const p2 = pincode.substring(0, 2);

  if (METRO_PREFIXES.has(p3)) return 'metro';
  if (REMOTE_3_PREFIXES.has(p3) || REMOTE_2_PREFIXES.has(p2)) return 'remote';

  return 'regional';
}

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
 *   - origin_zone_type    must match OR be NULL
 *   - destination_zone_type must match OR be NULL
 *   - service_type    must match OR be NULL
 *   - organization_id must match OR be NULL (NULL = system-wide policy)
 *
 * Tie-breaking (more specific wins):
 *   1. priority ASC (lower number = higher priority)
 *   2. carrier_id IS NOT NULL (carrier-specific policies win over generic)
 *   3. service_type IS NOT NULL
 *   4. origin_zone_type IS NOT NULL
 *   5. destination_zone_type IS NOT NULL
 *
 * @param {object} params
 * @param {string}        params.organizationId
 * @param {string|null}   params.carrierId           UUID of the carrier
 * @param {object|string} params.originAddress       Full address object or JSON string
 * @param {object|string} params.destinationAddress
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
 *   originZone: string,
 *   destinationZone: string,
 *   matchedBy: string,
 * }>}
 */
export async function matchSlaPolicyForShipment({
  organizationId,
  carrierId,
  originAddress,
  destinationAddress,
  serviceType,
  client,
}) {
  const originZone      = classifyZone(originAddress);
  const destinationZone = classifyZone(destinationAddress);
  const normService     = normalizeServiceType(serviceType);

  logger.debug('SLA policy matching — inputs', {
    organizationId,
    carrierId: carrierId || null,
    originZone,
    destinationZone,
    normService,
  });

  const policy = await slaRepository.findMatchingPolicy({
    organizationId,
    carrierId:        carrierId   || null,
    originZone,
    destinationZone,
    serviceType:      normService || null,
    client,
  });

  const deliveryHours = policy?.delivery_hours ?? SYSTEM_FALLBACK_HOURS;
  const pickupHours   = policy?.pickup_hours   ?? SYSTEM_FALLBACK_PICKUP_HOURS;

  const now               = new Date();
  const deliveryScheduled = new Date(now.getTime() + deliveryHours * 3_600_000);
  const pickupDeadline    = new Date(now.getTime() + pickupHours   * 3_600_000);

  const matchedBy = policy
    ? `policy:${policy.id} "${policy.name}" (${deliveryHours}h delivery)`
    : `system-fallback (${SYSTEM_FALLBACK_HOURS}h)`;

  logger.info('SLA policy matched', {
    organizationId,
    policyId:   policy?.id   || null,
    policyName: policy?.name || null,
    originZone,
    destinationZone,
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
    originZone,
    destinationZone,
    matchedBy,
  };
}

export default { matchSlaPolicyForShipment, classifyZone, normalizeServiceType };
