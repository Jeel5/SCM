// Dashboard Controller - provides overview statistics and metrics
import dashboardRepo from '../repositories/DashboardRepository.js';
import { asyncHandler } from '../errors/index.js';
import { cacheWrap, orgSeg } from '../utils/cache.js';

/** Compute percentage change: ((current - previous) / previous) * 100 */
function pctChange(current, previous) {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (prev === 0) return cur > 0 ? 100 : 0;
  return parseFloat(((cur - prev) / prev * 100).toFixed(1));
}

// Map query-string period shortcuts to days
const PERIOD_MAP = { '1d': 1, '7d': 7, '30d': 30, '90d': 90, '365d': 365 };

// Get dashboard stats for orders, shipments, inventory, returns
export const getDashboardStats = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;
  const periodKey = req.query.period || '30d';
  const days = PERIOD_MAP[periodKey] || 30;

  // Cache the fully-computed response for 60 seconds.
  // All 8 parallel DB queries are inside the cache miss path — on a hit
  // the entire dashboard load costs a single Redis GET.
  const cacheKey = `dash:${orgSeg(organizationId)}:${periodKey}`;
  const data = await cacheWrap(cacheKey, 60, async () => {
    const [orders, shipments, lowStock, pendingReturns, activeExceptions, ordersTrend, warehouseActivity, topProducts] =
      await Promise.all([
        dashboardRepo.getOrderStats(organizationId, days),
        dashboardRepo.getShipmentStats(organizationId, days),
        dashboardRepo.getLowStockCount(organizationId, days),
        dashboardRepo.getPendingReturnsCount(organizationId, days),
        dashboardRepo.getActiveExceptionsCount(organizationId, days),
        dashboardRepo.getOrdersTrend(organizationId, days),
        dashboardRepo.getWarehouseActivity(organizationId, days),
        dashboardRepo.getTopProducts(organizationId, days),
      ]);

    const delivered = parseInt(shipments.delivered) || 0;
    const onTime   = parseInt(shipments.on_time)   || 0;
    const onTimeRate  = delivered > 0 ? parseFloat((onTime / delivered * 100).toFixed(1)) : 100;

    const prevDelivered = parseInt(shipments.prev_delivered) || 0;
    const prevOnTime    = parseInt(shipments.prev_on_time)   || 0;
    const prevOnTimeRate = prevDelivered > 0 ? parseFloat((prevOnTime / prevDelivered * 100).toFixed(1)) : 100;

    const avgDeliveryDays     = parseFloat(Number(shipments.avg_delivery_days).toFixed(1))     || 0;
    const prevAvgDeliveryDays = parseFloat(Number(shipments.prev_avg_delivery_days).toFixed(1)) || 0;

    const activityMap = {};
    for (const row of warehouseActivity) {
      activityMap[row.warehouse_id] = {
        inbound: parseInt(row.inbound_units) || 0,
        outbound: parseInt(row.outbound_units) || 0,
      };
    }

    return {
      period: periodKey,
      days,
      orders: {
        total:      parseInt(orders.total),
        pending:    parseInt(orders.pending),
        processing: parseInt(orders.processing),
        shipped:    parseInt(orders.shipped),
        delivered:  parseInt(orders.delivered),
        cancelled:  parseInt(orders.cancelled) || 0,
        returned:   parseInt(orders.returned)  || 0,
        totalValue: parseFloat(orders.total_value),
        change:     pctChange(orders.total, orders.prev_total),
        revenueChange: pctChange(orders.total_value, orders.prev_total_value),
      },
      shipments: {
        total:      parseInt(shipments.total),
        inTransit:  parseInt(shipments.in_transit),
        delivered,
        onTimeRate,
        avgDeliveryDays,
        change:     pctChange(shipments.total, shipments.prev_total),
        onTimeRateChange: pctChange(onTimeRate, prevOnTimeRate),
        avgDeliveryChange: prevAvgDeliveryDays > 0
          ? pctChange(prevAvgDeliveryDays, avgDeliveryDays)
          : 0,
      },
      inventory: { lowStockAlerts: lowStock },
      returns: {
        pending: parseInt(pendingReturns.pending_returns) || 0,
        change:  pctChange(pendingReturns.pending_returns, pendingReturns.prev_pending_returns),
      },
      exceptions: {
        active: parseInt(activeExceptions.active_exceptions) || 0,
        change: pctChange(activeExceptions.current_created, activeExceptions.prev_created),
      },
      ordersTrend: ordersTrend.map(r => ({
        date: r.date,
        count: parseInt(r.count),
        value: parseFloat(r.value),
      })),
      warehouseActivity: activityMap,
      topProducts: topProducts.map(r => ({
        name: r.name,
        sku: r.sku,
        unitsSold: parseInt(r.units_sold),
        revenue: parseFloat(r.revenue),
      })),
    };
  });

  res.json({ success: true, data });
});
