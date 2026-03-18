import fs from 'fs';
import readline from 'readline';

export const DEFAULT_MAX_IMPORT_ROWS = 200_000;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Parse a CSV line while honoring quoted commas and escaped quotes. */
export function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/** Stream parsed CSV rows as plain objects with header-based keys. */
export async function* iterCsvRows(filePath, maxRows = DEFAULT_MAX_IMPORT_ROWS) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let headers = null;
  let seenRows = 0;

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;

    if (!headers) {
      const normalized = rawLine.charCodeAt(0) === 0xfeff ? rawLine.slice(1) : rawLine;
      headers = parseCsvLine(normalized).map((h) => h.trim());
      continue;
    }

    const values = parseCsvLine(rawLine);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim();
    });

    if (Object.values(row).every((v) => !v)) continue;

    seenRows++;
    if (seenRows > maxRows) {
      throw new Error(`CSV too large: exceeds ${maxRows} rows`);
    }

    yield row;
  }
}

/** Parse a JSON object-like value safely, returning null on invalid data. */
export function parseJsonObject(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** Normalize text into a case-insensitive alphanumeric lookup key. */
export function normalizeLookupKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Normalize external shipment statuses into internal allowed status values. */
export function normalizeShipmentStatus(rawStatus) {
  const status = String(rawStatus || 'delivered').toLowerCase().trim();
  const statusMap = {
    pickup_scheduled: 'pending',
    created: 'pending',
    at_hub: 'in_transit',
    failed_delivery: 'exception',
    failed: 'exception',
    exception: 'exception',
  };
  const normalized = statusMap[status] || status;
  const validStatuses = [
    'pending', 'picked_up', 'in_transit', 'out_for_delivery',
    'delivered', 'cancelled', 'exception', 'returned',
  ];
  return validStatuses.includes(normalized) ? normalized : 'delivered';
}

/** Build normalized address object from prefixed CSV columns and fallback data. */
export function buildAddress(prefix, row, fallback = null) {
  const street = row[`${prefix}_street`] || row[`${prefix}_address`] || fallback?.street || 'N/A';
  const city = row[`${prefix}_city`] || fallback?.city || 'Unknown';
  const state = row[`${prefix}_state`] || fallback?.state || '';
  const postalCode = row[`${prefix}_postal_code`] || row[`${prefix}_postalCode`] || fallback?.postal_code || '';
  const country = row[`${prefix}_country`] || fallback?.country || 'India';

  return {
    street,
    city,
    state,
    postal_code: postalCode,
    country,
  };
}

/** Build synthetic shipment timeline events from imported shipment status context. */
export function buildShipmentEvents(status, origin, destination, currentLocation, pickupActual, deliveryActual) {
  const baseTime = new Date();
  const pickupTime = pickupActual ? new Date(pickupActual) : new Date(baseTime.getTime() - 2 * 24 * 3_600_000);
  const transitTime = new Date(pickupTime.getTime() + 12 * 3_600_000);
  const outForDeliveryTime = new Date(transitTime.getTime() + 24 * 3_600_000);
  const deliveredTime = deliveryActual ? new Date(deliveryActual) : new Date(outForDeliveryTime.getTime() + 6 * 3_600_000);

  const eventSets = {
    pending: [],
    picked_up: [
      { event_type: 'picked_up', description: 'Shipment picked up from origin', location: origin, event_timestamp: pickupTime },
    ],
    in_transit: [
      { event_type: 'picked_up', description: 'Shipment picked up from origin', location: origin, event_timestamp: pickupTime },
      { event_type: 'in_transit', description: 'Shipment is in transit', location: currentLocation || origin, event_timestamp: transitTime },
    ],
    out_for_delivery: [
      { event_type: 'picked_up', description: 'Shipment picked up from origin', location: origin, event_timestamp: pickupTime },
      { event_type: 'in_transit', description: 'Shipment is in transit', location: currentLocation || origin, event_timestamp: transitTime },
      { event_type: 'out_for_delivery', description: 'Shipment is out for delivery', location: currentLocation || destination, event_timestamp: outForDeliveryTime },
    ],
    delivered: [
      { event_type: 'picked_up', description: 'Shipment picked up from origin', location: origin, event_timestamp: pickupTime },
      { event_type: 'in_transit', description: 'Shipment is in transit', location: currentLocation || origin, event_timestamp: transitTime },
      { event_type: 'out_for_delivery', description: 'Shipment is out for delivery', location: destination, event_timestamp: outForDeliveryTime },
      { event_type: 'delivered', description: 'Shipment delivered successfully', location: destination, event_timestamp: deliveredTime },
    ],
    returned: [
      { event_type: 'picked_up', description: 'Shipment picked up from origin', location: origin, event_timestamp: pickupTime },
      { event_type: 'in_transit', description: 'Shipment is in transit', location: currentLocation || origin, event_timestamp: transitTime },
      { event_type: 'returned', description: 'Shipment returned to sender', location: origin, event_timestamp: deliveredTime },
    ],
    cancelled: [
      { event_type: 'cancelled', description: 'Shipment cancelled before delivery', location: origin, event_timestamp: pickupTime },
    ],
    exception: [
      { event_type: 'picked_up', description: 'Shipment picked up from origin', location: origin, event_timestamp: pickupTime },
      { event_type: 'exception', description: 'Shipment hit an exception in transit', location: currentLocation || destination, event_timestamp: deliveredTime },
    ],
  };

  return eventSets[status] || [];
}
