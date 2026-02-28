// Dashboard Controller - provides overview statistics and metrics
import dashboardRepo from '../repositories/DashboardRepository.js';
import { asyncHandler } from '../errors/index.js';

// Get dashboard stats for orders, shipments, inventory, returns
export const getDashboardStats = asyncHandler(async (req, res) => {
  const organizationId = req.orgContext?.organizationId;

  // Run all 5 independent queries in parallel for ~4x latency improvement
  const [orders, shipments, lowStock, pendingReturns, activeExceptions] =
    await Promise.all([
      dashboardRepo.getOrderStats(organizationId),
      dashboardRepo.getShipmentStats(organizationId),
      dashboardRepo.getLowStockCount(organizationId),
      dashboardRepo.getPendingReturnsCount(organizationId),
      dashboardRepo.getActiveExceptionsCount(organizationId),
    ]);

  const onTimeRate = parseInt(shipments.delivered) > 0
    ? (parseInt(shipments.on_time) / parseInt(shipments.delivered) * 100).toFixed(1)
    : 100;

  res.json({
    success: true,
    data: {
      orders: {
        total:      parseInt(orders.total),
        pending:    parseInt(orders.pending),
        processing: parseInt(orders.processing),
        shipped:    parseInt(orders.shipped),
        delivered:  parseInt(orders.delivered),
        totalValue: parseFloat(orders.total_value)
      },
      shipments: {
        total:      parseInt(shipments.total),
        inTransit:  parseInt(shipments.in_transit),
        delivered:  parseInt(shipments.delivered),
        onTimeRate: parseFloat(onTimeRate)
      },
      inventory: {
        lowStockAlerts: lowStock
      },
      returns: {
        pending: pendingReturns
      },
      exceptions: {
        active: activeExceptions
      }
    }
  });
});
