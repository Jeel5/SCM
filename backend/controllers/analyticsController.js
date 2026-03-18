// Analytics Controller - provides comprehensive analytics and reporting
import analyticsRepo from '../repositories/AnalyticsRepository.js';
import logger from '../utils/logger.js';
import { asyncHandler, ValidationError } from '../errors/index.js';
import { cacheWrap, orgSeg } from '../utils/cache.js';
import { getTrailingDateWindow, syncAnalyticsStats } from '../services/analyticsStatsService.js';

// Get analytics data with time-series trends and breakdowns
export const getAnalytics = asyncHandler(async (req, res) => {
  const { range = 'month' } = req.validatedQuery ?? req.query; // day, week, month, year
  const organizationId = req.orgContext?.organizationId;

  // Cache the fully-computed analytics response for 5 minutes.
  // 8 heavy aggregation queries across orders/shipments/inventory are inside
  // the miss path — a cache hit costs only a single Redis GET.
  const cacheKey = `analytics:${orgSeg(organizationId)}:${range}`;
  const data = await cacheWrap(cacheKey, 300, async () => {
    if (organizationId) {
      const days = range === 'day' ? 1 : range === 'week' ? 7 : range === 'year' ? 365 : 30;
      const { startDate, endDate } = getTrailingDateWindow(days);
      await syncAnalyticsStats(organizationId, { startDate, endDate });
    }

    let interval = '30 days';
    let dateGrouping = "DATE(created_at)";

    if (range === 'day') {
      interval = '1 day';
      dateGrouping = "DATE_TRUNC('hour', created_at)";
    } else if (range === 'week') {
      interval = '7 days';
      dateGrouping = "DATE(created_at)";
    } else if (range === 'year') {
      interval = '1 year';
      dateGrouping = "DATE_TRUNC('month', created_at)";
    }

    const orgParam = organizationId ? 1 : null;
    const intParam = organizationId ? 2 : 1;
    const baseArgs  = organizationId ? [organizationId, interval] : [interval];
    const orgClause = organizationId ? `AND organization_id = $${orgParam}` : '';
    const orgClauseAlias = (alias) => organizationId ? `AND ${alias}.organization_id = $${orgParam}` : '';
    const intClause = `NOW() - $${intParam}::INTERVAL`;

    const [
      ordersOverTime,
      shipmentsByCarrier,
      topProducts,
      warehouseUtil,
      slaViolations,
      exceptionsByType,
      returnsAnalysis,
      financialMetrics,
    ] = await Promise.all([
      analyticsRepo.getOrdersOverTime({ dateGrouping, intClause, orgClause, baseArgs }),
      analyticsRepo.getShipmentsByCarrier({ intClause, orgClauseAlias, baseArgs }),
      analyticsRepo.getTopProducts({ intClause, orgClauseAlias, baseArgs }),
      analyticsRepo.getWarehouseUtilization({ intClause, orgParam, baseArgs }),
      analyticsRepo.getSlaViolations({ dateGrouping, intClause, orgClause, baseArgs }),
      analyticsRepo.getExceptionsByType({ intClause, orgClause, baseArgs }),
      analyticsRepo.getReturnsAnalysis({ intClause, orgClause, baseArgs }),
      analyticsRepo.getFinancialMetrics({ intClause, orgClause, baseArgs }),
    ]);

    const shipmentsByCarrierFormatted = shipmentsByCarrier.rows.map(r => {
      const delivered = parseInt(r.delivered, 10);
      const total = parseInt(r.total_shipments, 10);
      const onTime = parseInt(r.on_time_deliveries, 10);
      return {
        carrier: r.carrier,
        carrierId: r.carrier_id,
        totalShipments: total,
        delivered,
        onTimeRate: delivered > 0 ? ((onTime / delivered) * 100).toFixed(1) : '100.0',
        avgDelayHours: r.avg_delay_hours ? parseFloat(r.avg_delay_hours).toFixed(1) : '0.0',
        totalCost: parseFloat(r.total_cost)
      };
    });

    return {
      timeRange: range,
      ordersOverTime: ordersOverTime.rows.map(r => ({
        date: r.date,
        count: parseInt(r.count, 10),
        value: parseFloat(r.value),
        delivered: parseInt(r.delivered, 10),
        inTransit: parseInt(r.in_transit, 10),
        pending: parseInt(r.pending, 10)
      })),
      shipmentsByCarrier: shipmentsByCarrierFormatted,
      topProducts: topProducts.rows.map(r => ({
        name: r.name,
        sku: r.sku,
        category: r.category,
        unitsSold: parseInt(r.units_sold, 10),
        revenue: parseFloat(r.revenue),
        orderCount: parseInt(r.order_count, 10)
      })),
      warehouseUtilization: warehouseUtil.rows.map(r => ({
        name: r.name,
        code: r.code,
        capacity: r.capacity,
        currentStock: parseInt(r.current_stock, 10),
        utilization: r.capacity > 0 ? Math.round((parseInt(r.current_stock, 10) / r.capacity) * 100) : 0,
        shipmentsProcessed: parseInt(r.shipments_processed, 10),
        ordersFulfilled: parseInt(r.orders_fulfilled, 10)
      })),
      slaViolations: slaViolations.rows.map(r => ({
        date: r.date,
        violations: parseInt(r.violations, 10),
        totalPenalties: parseFloat(r.total_penalties)
      })),
      exceptionsByType: exceptionsByType.rows.map(r => ({
        type: r.exception_type,
        severity: r.severity,
        count: parseInt(r.count, 10),
        resolved: parseInt(r.resolved, 10),
        avgResolutionHours: r.avg_resolution_hours ? parseFloat(r.avg_resolution_hours).toFixed(1) : null
      })),
      returnsAnalysis: {
        totalReturns: parseInt(returnsAnalysis.rows[0].total_returns, 10),
        refunded: parseInt(returnsAnalysis.rows[0].refunded, 10),
        totalRefundAmount: parseFloat(returnsAnalysis.rows[0].total_refund_amount),
        avgRefundAmount: parseFloat(returnsAnalysis.rows[0].avg_refund_amount),
        qualityPassed: parseInt(returnsAnalysis.rows[0].quality_passed, 10),
        qualityFailed: parseInt(returnsAnalysis.rows[0].quality_failed, 10)
      },
      financialMetrics: {
        totalRevenue: parseFloat(financialMetrics.rows[0].total_revenue),
        totalShippingCost: parseFloat(financialMetrics.rows[0].total_shipping_cost),
        totalPenalties: parseFloat(financialMetrics.rows[0].total_penalties),
        totalRefunds: parseFloat(financialMetrics.rows[0].total_refunds),
        totalOrders: parseInt(financialMetrics.rows[0].total_orders, 10),
        avgOrderValue: parseFloat(financialMetrics.rows[0].avg_order_value)
      }
    };
  });

  res.json({ success: true, data });
});

// ─── Analytics CSV Export ──────────────────────────────────────────────────
// GET /api/analytics/export?type=orders|shipments|returns|violations&range=day|week|month|year
// Returns a CSV file download scoped to the authenticated org.
export const getAnalyticsExport = asyncHandler(async (req, res) => {
  const { type = 'orders', range = 'month' } = req.validatedQuery ?? req.query;

  const VALID_TYPES = ['orders', 'shipments', 'returns', 'violations'];
  if (!VALID_TYPES.includes(type)) {
    throw new ValidationError(`Invalid export type. Must be one of: ${VALID_TYPES.join(', ')}`);
  }

    // Map range to interval (same whitelist as getAnalytics — no interpolation)
    const RANGE_MAP = { day: '1 day', week: '7 days', month: '30 days', year: '1 year' };
    const interval = RANGE_MAP[range] || '30 days';

    const organizationId = req.orgContext?.organizationId;
    const params = organizationId ? [organizationId, interval] : [interval];
    const orgClause = organizationId ? 'AND organization_id = $1' : '';
    const intIdx   = organizationId ? '$2' : '$1';

    let rows = [];
    let columns = [];

    if (type === 'orders') {
      columns = ['order_number', 'customer_name', 'customer_email', 'status', 'total_amount', 'currency', 'created_at'];
      const result = await analyticsRepo.exportOrders({ intIdx, orgClause, params });
      rows = result.rows;

    } else if (type === 'shipments') {
      columns = ['id', 'tracking_number', 'carrier_name', 'status', 'shipping_cost', 'estimated_delivery', 'delivery_actual', 'created_at'];
      const result = await analyticsRepo.exportShipments({ intIdx, orgParam: organizationId, params });
      rows = result.rows;

    } else if (type === 'returns') {
      columns = ['rma_number', 'customer_name', 'status', 'refund_amount', 'reason', 'requested_at'];
      const result = await analyticsRepo.exportReturns({ intIdx, orgClause, params });
      rows = result.rows;

    } else if (type === 'violations') {
      columns = ['id', 'shipment_id', 'policy_name', 'violation_type', 'penalty_amount', 'violated_at'];
      const result = await analyticsRepo.exportViolations({ intIdx, orgParam: organizationId, params });
      rows = result.rows;
    }

    // Serialize to CSV
    const escapeCell = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      // Wrap in quotes if value contains comma, quote, or newline
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const csvLines = [
      columns.join(','),
      ...rows.map(row => columns.map(col => escapeCell(row[col])).join(','))
    ];
    const csv = csvLines.join('\r\n');

    const filename = `${type}-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});
