// Analytics Controller - provides comprehensive analytics and reporting
import analyticsRepo from '../repositories/AnalyticsRepository.js';
import logger from '../utils/logger.js';
import { asyncHandler, ValidationError } from '../errors/index.js';

// Get analytics data with time-series trends and breakdowns
export const getAnalytics = asyncHandler(async (req, res) => {
  const { range = 'month' } = req.query; // day, week, month, year
    
    // Map range to SQL interval
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

    const organizationId = req.orgContext?.organizationId;

    // Build query param array: [interval, orgId?]
    // Using $N::INTERVAL avoids interpolating user-controlled strings into SQL (TASK-R8-016).
    // interval values are already whitelisted above, but parameterize for hygiene.
    const orgParam = organizationId ? 1 : null;   // index of orgId param when present
    const intParam = organizationId ? 2 : 1;       // index of interval param

    const baseArgs  = organizationId ? [organizationId, interval] : [interval];

    // Convenience helpers so each query below can reference the right param indices
    const orgClause = organizationId ? `AND organization_id = $${orgParam}` : '';
    const orgClauseAlias = (alias) => organizationId ? `AND ${alias}.organization_id = $${orgParam}` : '';
    const intClause = `NOW() - $${intParam}::INTERVAL`;

    // Run all 8 independent queries in parallel for ~6-8x latency improvement
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

    // Calculate derived metrics
    const shipmentsByCarrierFormatted = shipmentsByCarrier.rows.map(r => {
      const delivered = parseInt(r.delivered);
      const total = parseInt(r.total_shipments);
      const onTime = parseInt(r.on_time_deliveries);
      
      return {
        carrier: r.carrier,
        carrierId: r.carrier_id,
        totalShipments: total,
        delivered: delivered,
        onTimeRate: delivered > 0 ? ((onTime / delivered) * 100).toFixed(1) : '100.0',
        avgDelayHours: r.avg_delay_hours ? parseFloat(r.avg_delay_hours).toFixed(1) : '0.0',
        totalCost: parseFloat(r.total_cost)
      };
    });
    
    res.json({
      success: true,
      data: {
        timeRange: range,
        ordersOverTime: ordersOverTime.rows.map(r => ({
          date: r.date,
          count: parseInt(r.count),
          value: parseFloat(r.value),
          delivered: parseInt(r.delivered),
          inTransit: parseInt(r.in_transit),
          pending: parseInt(r.pending)
        })),
        shipmentsByCarrier: shipmentsByCarrierFormatted,
        topProducts: topProducts.rows.map(r => ({
          name: r.name,
          sku: r.sku,
          category: r.category,
          unitsSold: parseInt(r.units_sold),
          revenue: parseFloat(r.revenue),
          orderCount: parseInt(r.order_count)
        })),
        warehouseUtilization: warehouseUtil.rows.map(r => ({
          name: r.name,
          code: r.code,
          capacity: r.capacity,
          currentStock: parseInt(r.current_stock),
          utilization: r.capacity > 0 ? Math.round((parseInt(r.current_stock) / r.capacity) * 100) : 0,
          shipmentsProcessed: parseInt(r.shipments_processed),
          ordersFulfilled: parseInt(r.orders_fulfilled)
        })),
        slaViolations: slaViolations.rows.map(r => ({
          date: r.date,
          violations: parseInt(r.violations),
          totalPenalties: parseFloat(r.total_penalties)
        })),
        exceptionsByType: exceptionsByType.rows.map(r => ({
          type: r.exception_type,
          severity: r.severity,
          count: parseInt(r.count),
          resolved: parseInt(r.resolved),
          avgResolutionHours: r.avg_resolution_hours ? parseFloat(r.avg_resolution_hours).toFixed(1) : null
        })),
        returnsAnalysis: {
          totalReturns: parseInt(returnsAnalysis.rows[0].total_returns),
          refunded: parseInt(returnsAnalysis.rows[0].refunded),
          totalRefundAmount: parseFloat(returnsAnalysis.rows[0].total_refund_amount),
          avgRefundAmount: parseFloat(returnsAnalysis.rows[0].avg_refund_amount),
          qualityPassed: parseInt(returnsAnalysis.rows[0].quality_passed),
          qualityFailed: parseInt(returnsAnalysis.rows[0].quality_failed)
        },
        financialMetrics: {
          totalRevenue: parseFloat(financialMetrics.rows[0].total_revenue),
          totalShippingCost: parseFloat(financialMetrics.rows[0].total_shipping_cost),
          totalPenalties: parseFloat(financialMetrics.rows[0].total_penalties),
          totalRefunds: parseFloat(financialMetrics.rows[0].total_refunds),
          totalOrders: parseInt(financialMetrics.rows[0].total_orders),
          avgOrderValue: parseFloat(financialMetrics.rows[0].avg_order_value)
        }
      }
    });

});

// ─── Analytics CSV Export ──────────────────────────────────────────────────
// GET /api/analytics/export?type=orders|shipments|returns|violations&range=day|week|month|year
// Returns a CSV file download scoped to the authenticated org.
export const getAnalyticsExport = asyncHandler(async (req, res) => {
  const { type = 'orders', range = 'month' } = req.query;

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
