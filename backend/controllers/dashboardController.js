// Dashboard Controller - provides overview statistics and metrics
import pool from '../configs/db.js';

// Get dashboard stats for orders, shipments, inventory, returns
export async function getDashboardStats(req, res) {
  try {
    // Orders stats
    const ordersResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status IN ('created','confirmed') THEN 1 END) as pending,
        COUNT(CASE WHEN status IN ('allocated','processing') THEN 1 END) as processing,
        COUNT(CASE WHEN status IN ('shipped','in_transit','out_for_delivery') THEN 1 END) as shipped,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
        COALESCE(SUM(total_amount), 0) as total_value
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);
    
    // Shipments stats
    const shipmentsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN s.status IN ('picked_up','in_transit','at_hub','out_for_delivery') THEN 1 END) as in_transit,
        COUNT(CASE WHEN s.status = 'delivered' THEN 1 END) as delivered,
        COUNT(
          CASE 
            WHEN o.actual_delivery IS NOT NULL 
             AND o.estimated_delivery IS NOT NULL
             AND o.actual_delivery <= o.estimated_delivery
            THEN 1 
          END
        ) as on_time
      FROM shipments s
      LEFT JOIN orders o ON o.id = s.order_id
      WHERE s.created_at >= NOW() - INTERVAL '30 days'
    `);
    
    // Inventory alerts
    const inventoryResult = await pool.query(`
      SELECT COUNT(*) as low_stock
      FROM inventory
      WHERE available_quantity <= 5
    `);
    
    // Returns stats
    const returnsResult = await pool.query(`
      SELECT COUNT(*) as pending_returns
      FROM returns
      WHERE status IN ('pending', 'approved', 'processing')
    `);
    
    // Exceptions
    const exceptionsResult = await pool.query(`
      SELECT COUNT(*) as active_exceptions
      FROM exceptions
      WHERE status = 'open'
    `);
    
    const orders = ordersResult.rows[0];
    const shipments = shipmentsResult.rows[0];
    
    const onTimeRate = parseInt(shipments.delivered) > 0
      ? (parseInt(shipments.on_time) / parseInt(shipments.delivered) * 100).toFixed(1)
      : 100;
    
    res.json({
      success: true,
      data: {
        orders: {
          total: parseInt(orders.total),
          pending: parseInt(orders.pending),
          processing: parseInt(orders.processing),
          shipped: parseInt(orders.shipped),
          delivered: parseInt(orders.delivered),
          totalValue: parseFloat(orders.total_value)
        },
        shipments: {
          total: parseInt(shipments.total),
          inTransit: parseInt(shipments.in_transit),
          delivered: parseInt(shipments.delivered),
          onTimeRate: parseFloat(onTimeRate)
        },
        inventory: {
          lowStockAlerts: parseInt(inventoryResult.rows[0].low_stock)
        },
        returns: {
          pending: parseInt(returnsResult.rows[0].pending_returns)
        },
        exceptions: {
          active: parseInt(exceptionsResult.rows[0].active_exceptions)
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
}
