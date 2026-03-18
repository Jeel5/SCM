import BaseRepository from '../repositories/BaseRepository.js';
import { withTransaction } from '../utils/dbTransaction.js';

const repo = new BaseRepository('analytics_daily_stats');

/**
 * Convert a Date to YYYY-MM-DD for analytics date filtering.
 */
function toDateString(value) {
  return value.toISOString().slice(0, 10);
}

/**
 * Build a trailing inclusive date window ending today in UTC.
 */
export function getTrailingDateWindow(days) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(days - 1, 0));

  return {
    startDate: toDateString(start),
    endDate: toDateString(end),
  };
}

/**
 * Rebuild analytics_daily_stats rows for a date range.
 */
async function refreshDailyStats(organizationId, startDate, endDate, tx) {
  await repo.query(
    `DELETE FROM analytics_daily_stats
     WHERE organization_id = $1 AND stat_date BETWEEN $2::date AND $3::date`,
    [organizationId, startDate, endDate],
    tx
  );

  await repo.query(
    `WITH dates AS (
       SELECT generate_series($2::date, $3::date, '1 day'::interval)::date AS stat_date
     ),
     orders_agg AS (
       SELECT
         DATE(created_at) AS stat_date,
         COUNT(*) AS orders_total,
         COUNT(*) FILTER (WHERE status IN ('created', 'confirmed', 'pending_carrier_assignment', 'allocated')) AS orders_pending,
         COUNT(*) FILTER (WHERE status IN ('processing', 'ready_to_ship')) AS orders_processing,
         COUNT(*) FILTER (WHERE status IN ('shipped', 'in_transit', 'out_for_delivery')) AS orders_shipped,
         COUNT(*) FILTER (WHERE status = 'delivered') AS orders_delivered,
         COUNT(*) FILTER (WHERE status = 'cancelled') AS orders_cancelled,
         COUNT(*) FILTER (WHERE status = 'returned') AS orders_returned,
         COALESCE(SUM(total_amount), 0) AS orders_value
       FROM orders
       WHERE organization_id = $1
         AND DATE(created_at) BETWEEN $2::date AND $3::date
       GROUP BY 1
     ),
     shipments_agg AS (
       SELECT
         DATE(s.created_at) AS stat_date,
         COUNT(*) AS shipments_total,
         COUNT(*) FILTER (WHERE s.status IN ('picked_up', 'in_transit', 'at_hub')) AS shipments_in_transit,
         COUNT(*) FILTER (WHERE s.status = 'out_for_delivery') AS shipments_out_for_delivery,
         COUNT(*) FILTER (WHERE s.status = 'delivered') AS shipments_delivered,
         COUNT(*) FILTER (WHERE s.status = 'failed_delivery') AS shipments_failed,
         COUNT(*) FILTER (
           WHERE COALESCE(s.delivery_actual, o.actual_delivery) IS NOT NULL
             AND s.delivery_scheduled IS NOT NULL
             AND COALESCE(s.delivery_actual, o.actual_delivery) <= s.delivery_scheduled
         ) AS shipments_on_time,
          COALESCE(SUM(s.shipping_cost), 0) AS shipping_cost_total,
         COALESCE(
           AVG(EXTRACT(EPOCH FROM (COALESCE(s.delivery_actual, o.actual_delivery) - s.created_at)) / 86400)
             FILTER (WHERE s.status = 'delivered' AND COALESCE(s.delivery_actual, o.actual_delivery) IS NOT NULL),
           0
         ) AS avg_delivery_days
       FROM shipments s
       LEFT JOIN orders o ON o.id = s.order_id
       WHERE s.organization_id = $1
         AND DATE(s.created_at) BETWEEN $2::date AND $3::date
       GROUP BY 1
     ),
     returns_agg AS (
       SELECT
         DATE(requested_at) AS stat_date,
         COUNT(*) AS returns_total,
         COUNT(*) FILTER (WHERE status NOT IN ('refunded', 'rejected')) AS returns_pending,
         COUNT(*) FILTER (WHERE status = 'refunded') AS returns_refunded,
         COALESCE(SUM(refund_amount) FILTER (WHERE status = 'refunded'), 0) AS refund_amount
       FROM returns
       WHERE organization_id = $1
         AND DATE(requested_at) BETWEEN $2::date AND $3::date
       GROUP BY 1
     ),
     exceptions_agg AS (
       SELECT DATE(created_at) AS stat_date, COUNT(*) AS exceptions_created
       FROM exceptions
       WHERE organization_id = $1
         AND DATE(created_at) BETWEEN $2::date AND $3::date
       GROUP BY 1
     ),
     violations_agg AS (
       SELECT
         DATE(COALESCE(violated_at, created_at)) AS stat_date,
         COUNT(*) AS sla_violations,
         COALESCE(SUM(penalty_amount), 0) AS penalties_total
       FROM sla_violations
       WHERE organization_id = $1
         AND DATE(COALESCE(violated_at, created_at)) BETWEEN $2::date AND $3::date
       GROUP BY 1
     )
     INSERT INTO analytics_daily_stats (
       organization_id,
       stat_date,
       orders_total,
       orders_pending,
       orders_processing,
       orders_shipped,
       orders_delivered,
       orders_cancelled,
       orders_returned,
       orders_value,
       shipments_total,
       shipments_in_transit,
       shipments_out_for_delivery,
       shipments_delivered,
       shipments_failed,
       shipments_on_time,
      shipping_cost_total,
       avg_delivery_days,
       returns_total,
       returns_pending,
       returns_refunded,
       refund_amount,
       exceptions_created,
       sla_violations,
       penalties_total,
       created_at,
       updated_at
     )
     SELECT
       $1,
       d.stat_date,
       COALESCE(o.orders_total, 0),
       COALESCE(o.orders_pending, 0),
       COALESCE(o.orders_processing, 0),
       COALESCE(o.orders_shipped, 0),
       COALESCE(o.orders_delivered, 0),
       COALESCE(o.orders_cancelled, 0),
       COALESCE(o.orders_returned, 0),
       COALESCE(o.orders_value, 0),
       COALESCE(s.shipments_total, 0),
       COALESCE(s.shipments_in_transit, 0),
       COALESCE(s.shipments_out_for_delivery, 0),
       COALESCE(s.shipments_delivered, 0),
       COALESCE(s.shipments_failed, 0),
       COALESCE(s.shipments_on_time, 0),
      COALESCE(s.shipping_cost_total, 0),
       COALESCE(s.avg_delivery_days, 0),
       COALESCE(r.returns_total, 0),
       COALESCE(r.returns_pending, 0),
       COALESCE(r.returns_refunded, 0),
       COALESCE(r.refund_amount, 0),
       COALESCE(e.exceptions_created, 0),
       COALESCE(v.sla_violations, 0),
       COALESCE(v.penalties_total, 0),
       NOW(),
       NOW()
     FROM dates d
     LEFT JOIN orders_agg o ON o.stat_date = d.stat_date
     LEFT JOIN shipments_agg s ON s.stat_date = d.stat_date
     LEFT JOIN returns_agg r ON r.stat_date = d.stat_date
     LEFT JOIN exceptions_agg e ON e.stat_date = d.stat_date
     LEFT JOIN violations_agg v ON v.stat_date = d.stat_date
     ON CONFLICT (organization_id, stat_date) DO UPDATE SET
       orders_total = EXCLUDED.orders_total,
       orders_pending = EXCLUDED.orders_pending,
       orders_processing = EXCLUDED.orders_processing,
       orders_shipped = EXCLUDED.orders_shipped,
       orders_delivered = EXCLUDED.orders_delivered,
       orders_cancelled = EXCLUDED.orders_cancelled,
       orders_returned = EXCLUDED.orders_returned,
       orders_value = EXCLUDED.orders_value,
       shipments_total = EXCLUDED.shipments_total,
       shipments_in_transit = EXCLUDED.shipments_in_transit,
       shipments_out_for_delivery = EXCLUDED.shipments_out_for_delivery,
       shipments_delivered = EXCLUDED.shipments_delivered,
       shipments_failed = EXCLUDED.shipments_failed,
       shipments_on_time = EXCLUDED.shipments_on_time,
       shipping_cost_total = EXCLUDED.shipping_cost_total,
       avg_delivery_days = EXCLUDED.avg_delivery_days,
       returns_total = EXCLUDED.returns_total,
       returns_pending = EXCLUDED.returns_pending,
       returns_refunded = EXCLUDED.returns_refunded,
       refund_amount = EXCLUDED.refund_amount,
       exceptions_created = EXCLUDED.exceptions_created,
       sla_violations = EXCLUDED.sla_violations,
       penalties_total = EXCLUDED.penalties_total,
       updated_at = NOW()`,
    [organizationId, startDate, endDate],
    tx
  );
}

/**
 * Rebuild daily carrier analytics rows for a date range.
 */
async function refreshCarrierStats(organizationId, startDate, endDate, tx) {
  await repo.query(
    `DELETE FROM analytics_daily_carrier_stats
     WHERE organization_id = $1 AND stat_date BETWEEN $2::date AND $3::date`,
    [organizationId, startDate, endDate],
    tx
  );

  await repo.query(
    `INSERT INTO analytics_daily_carrier_stats (
       organization_id,
       stat_date,
       carrier_id,
       total_shipments,
       delivered_shipments,
       on_time_deliveries,
       failed_deliveries,
       total_cost,
       avg_delay_hours,
       created_at,
       updated_at
     )
     SELECT
       $1,
       DATE(s.created_at) AS stat_date,
       s.carrier_id,
       COUNT(*) AS total_shipments,
       COUNT(*) FILTER (WHERE s.status = 'delivered') AS delivered_shipments,
       COUNT(*) FILTER (
         WHERE COALESCE(s.delivery_actual, o.actual_delivery) IS NOT NULL
           AND s.delivery_scheduled IS NOT NULL
           AND COALESCE(s.delivery_actual, o.actual_delivery) <= s.delivery_scheduled
       ) AS on_time_deliveries,
       COUNT(*) FILTER (WHERE s.status = 'failed_delivery') AS failed_deliveries,
       COALESCE(SUM(s.shipping_cost), 0) AS total_cost,
       COALESCE(
         AVG(EXTRACT(EPOCH FROM (COALESCE(s.delivery_actual, o.actual_delivery) - s.delivery_scheduled)) / 3600)
           FILTER (WHERE COALESCE(s.delivery_actual, o.actual_delivery) IS NOT NULL AND s.delivery_scheduled IS NOT NULL),
         0
       ) AS avg_delay_hours,
       NOW(),
       NOW()
     FROM shipments s
     LEFT JOIN orders o ON o.id = s.order_id
     WHERE s.organization_id = $1
       AND s.carrier_id IS NOT NULL
       AND DATE(s.created_at) BETWEEN $2::date AND $3::date
     GROUP BY 2, 3
     ON CONFLICT (organization_id, stat_date, carrier_id) DO UPDATE SET
       total_shipments = EXCLUDED.total_shipments,
       delivered_shipments = EXCLUDED.delivered_shipments,
       on_time_deliveries = EXCLUDED.on_time_deliveries,
       failed_deliveries = EXCLUDED.failed_deliveries,
       total_cost = EXCLUDED.total_cost,
       avg_delay_hours = EXCLUDED.avg_delay_hours,
       updated_at = NOW()`,
    [organizationId, startDate, endDate],
    tx
  );
}

/**
 * Rebuild daily warehouse activity analytics rows for a date range.
 */
async function refreshWarehouseActivity(organizationId, startDate, endDate, tx) {
  await repo.query(
    `DELETE FROM analytics_daily_warehouse_activity
     WHERE organization_id = $1 AND stat_date BETWEEN $2::date AND $3::date`,
    [organizationId, startDate, endDate],
    tx
  );

  await repo.query(
    `WITH movement_agg AS (
       SELECT
         DATE(sm.created_at) AS stat_date,
         sm.warehouse_id,
         COUNT(*) FILTER (
           WHERE sm.movement_type IN ('inbound', 'transfer_in', 'return')
              OR (sm.movement_type = 'adjustment' AND sm.quantity > 0)
         ) AS inbound_count,
         COUNT(*) FILTER (
           WHERE sm.movement_type IN ('outbound', 'transfer_out', 'damaged', 'expired')
              OR (sm.movement_type = 'adjustment' AND sm.quantity < 0)
         ) AS outbound_count,
         COALESCE(SUM(
           CASE
             WHEN sm.movement_type IN ('inbound', 'transfer_in', 'return') THEN ABS(sm.quantity)
             WHEN sm.movement_type = 'adjustment' AND sm.quantity > 0 THEN ABS(sm.quantity)
             ELSE 0
           END
         ), 0) AS inbound_units,
         COALESCE(SUM(
           CASE
             WHEN sm.movement_type IN ('outbound', 'transfer_out', 'damaged', 'expired') THEN ABS(sm.quantity)
             WHEN sm.movement_type = 'adjustment' AND sm.quantity < 0 THEN ABS(sm.quantity)
             ELSE 0
           END
         ), 0) AS outbound_units
       FROM stock_movements sm
       JOIN warehouses w ON w.id = sm.warehouse_id
       WHERE w.organization_id = $1
         AND DATE(sm.created_at) BETWEEN $2::date AND $3::date
       GROUP BY 1, 2
     ),
     shipment_agg AS (
       SELECT DATE(created_at) AS stat_date, warehouse_id, COUNT(*) AS shipments_processed
       FROM shipments
       WHERE organization_id = $1
         AND warehouse_id IS NOT NULL
         AND DATE(created_at) BETWEEN $2::date AND $3::date
       GROUP BY 1, 2
     ),
     order_agg AS (
       SELECT DATE(o.created_at) AS stat_date, oi.warehouse_id, COUNT(DISTINCT oi.order_id) AS orders_fulfilled
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.organization_id = $1
         AND oi.warehouse_id IS NOT NULL
         AND DATE(o.created_at) BETWEEN $2::date AND $3::date
       GROUP BY 1, 2
     ),
     keys AS (
       SELECT stat_date, warehouse_id FROM movement_agg
       UNION
       SELECT stat_date, warehouse_id FROM shipment_agg
       UNION
       SELECT stat_date, warehouse_id FROM order_agg
     )
     INSERT INTO analytics_daily_warehouse_activity (
       organization_id,
       stat_date,
       warehouse_id,
       inbound_count,
       outbound_count,
       inbound_units,
       outbound_units,
       shipments_processed,
       orders_fulfilled,
       created_at,
       updated_at
     )
     SELECT
       $1,
       k.stat_date,
       k.warehouse_id,
       COALESCE(m.inbound_count, 0),
       COALESCE(m.outbound_count, 0),
       COALESCE(m.inbound_units, 0),
       COALESCE(m.outbound_units, 0),
       COALESCE(s.shipments_processed, 0),
       COALESCE(o.orders_fulfilled, 0),
       NOW(),
       NOW()
     FROM keys k
     LEFT JOIN movement_agg m ON m.stat_date = k.stat_date AND m.warehouse_id = k.warehouse_id
     LEFT JOIN shipment_agg s ON s.stat_date = k.stat_date AND s.warehouse_id = k.warehouse_id
     LEFT JOIN order_agg o ON o.stat_date = k.stat_date AND o.warehouse_id = k.warehouse_id
     ON CONFLICT (organization_id, stat_date, warehouse_id) DO UPDATE SET
       inbound_count = EXCLUDED.inbound_count,
       outbound_count = EXCLUDED.outbound_count,
       inbound_units = EXCLUDED.inbound_units,
       outbound_units = EXCLUDED.outbound_units,
       shipments_processed = EXCLUDED.shipments_processed,
       orders_fulfilled = EXCLUDED.orders_fulfilled,
       updated_at = NOW()`,
    [organizationId, startDate, endDate],
    tx
  );
}

/**
 * Sync all analytics summary tables inside a single transaction.
 */
export async function syncAnalyticsStats(organizationId, { startDate, endDate }) {
  if (!organizationId || !startDate || !endDate) {
    return;
  }

  await withTransaction(async (tx) => {
    await refreshDailyStats(organizationId, startDate, endDate, tx);
    await refreshCarrierStats(organizationId, startDate, endDate, tx);
    await refreshWarehouseActivity(organizationId, startDate, endDate, tx);
  });
}

export default {
  getTrailingDateWindow,
  syncAnalyticsStats,
};