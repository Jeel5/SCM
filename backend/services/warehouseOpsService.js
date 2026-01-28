// Warehouse Operations Service - Pick, Pack, Ship workflows
import pool from '../configs/db.js';
import { NotFoundError, BusinessLogicError } from '../errors/index.js';
import { logEvent } from '../utils/logger.js';

class WarehouseOpsService {
  /**
   * Create pick list for orders ready to be picked
   */
  async createPickList(warehouseId, orderIds, assignedTo) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Generate pick list number
      const pickListNumber = `PL-${Date.now()}`;

      // Get order items for the orders at this warehouse
      const itemsResult = await client.query(
        `SELECT oi.*, p.name as product_name
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.warehouse_id = $1
         AND oi.order_id = ANY($2)
         AND oi.pick_status = 'pending'
         ORDER BY p.category, p.sku`,
        [warehouseId, orderIds]
      );

      if (itemsResult.rows.length === 0) {
        throw new BusinessLogicError('No items available for picking');
      }

      // Create pick list
      const pickListResult = await client.query(
        `INSERT INTO pick_lists 
        (pick_list_number, warehouse_id, assigned_to, status, total_items)
        VALUES ($1, $2, $3, 'pending', $4)
        RETURNING *`,
        [pickListNumber, warehouseId, assignedTo, itemsResult.rows.length]
      );

      const pickList = pickListResult.rows[0];

      // Add items to pick list
      for (const item of itemsResult.rows) {
        await client.query(
          `INSERT INTO pick_list_items 
          (pick_list_id, order_item_id, product_id, quantity_required, location, status)
          VALUES ($1, $2, $3, $4, $5, 'pending')`,
          [pickList.id, item.id, item.product_id, item.quantity, 'A1-B2', ] // Location from inventory
        );

        // Update order item status
        await client.query(
          'UPDATE order_items SET pick_status = $1 WHERE id = $2',
          ['assigned', item.id]
        );
      }

      await client.query('COMMIT');

      logEvent('PickListCreated', {
        pickListId: pickList.id,
        pickListNumber,
        warehouseId,
        itemsCount: itemsResult.rows.length
      });

      return pickList;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Start picking process
   */
  async startPicking(pickListId, userId) {
    const result = await pool.query(
      `UPDATE pick_lists
       SET status = 'in_progress', started_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [pickListId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Pick list not found or already started');
    }

    logEvent('PickingStarted', { pickListId, userId });
    return result.rows[0];
  }

  /**
   * Mark item as picked
   */
  async pickItem(pickListItemId, quantityPicked, pickedBy) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get pick list item
      const itemResult = await client.query(
        `SELECT pli.*, oi.id as order_item_id, oi.quantity as required_quantity
         FROM pick_list_items pli
         JOIN order_items oi ON oi.id = pli.order_item_id
         WHERE pli.id = $1`,
        [pickListItemId]
      );

      if (itemResult.rows.length === 0) {
        throw new NotFoundError('Pick list item not found');
      }

      const item = itemResult.rows[0];
      const status = quantityPicked >= item.quantity_required ? 'picked' : 'short_picked';

      // Update pick list item
      await client.query(
        `UPDATE pick_list_items
         SET quantity_picked = $1, status = $2, picked_at = NOW()
         WHERE id = $3`,
        [quantityPicked, status, pickListItemId]
      );

      // Update order item
      await client.query(
        `UPDATE order_items
         SET pick_status = $1, picked_at = NOW(), picked_by = $2
         WHERE id = $3`,
        [status, pickedBy, item.order_item_id]
      );

      // Update pick list progress
      await client.query(
        `UPDATE pick_lists
         SET picked_items = picked_items + 1
         WHERE id = $1`,
        [item.pick_list_id]
      );

      // Check if pick list is complete
      const progressResult = await client.query(
        `SELECT total_items, picked_items FROM pick_lists WHERE id = $1`,
        [item.pick_list_id]
      );

      const progress = progressResult.rows[0];
      if (progress.picked_items >= progress.total_items) {
        await client.query(
          `UPDATE pick_lists SET status = 'completed', completed_at = NOW() WHERE id = $1`,
          [item.pick_list_id]
        );
      }

      await client.query('COMMIT');

      logEvent('ItemPicked', {
        pickListItemId,
        quantityPicked,
        status
      });

      return { success: true, status };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Pack order items
   */
  async packOrder(orderId, packedBy) {
    const result = await pool.query(
      `UPDATE order_items
       SET pack_status = 'packed', packed_at = NOW(), packed_by = $1
       WHERE order_id = $2 AND pick_status = 'picked' AND pack_status = 'pending'
       RETURNING *`,
      [packedBy, orderId]
    );

    if (result.rows.length === 0) {
      throw new BusinessLogicError('No items ready for packing or already packed');
    }

    // Check if all items are packed
    const checkResult = await pool.query(
      `SELECT COUNT(*) as total, 
              COUNT(CASE WHEN pack_status = 'packed' THEN 1 END) as packed
       FROM order_items WHERE order_id = $1`,
      [orderId]
    );

    const check = checkResult.rows[0];
    const allPacked = parseInt(check.total) === parseInt(check.packed);

    if (allPacked) {
      await pool.query(
        `UPDATE orders SET status = 'packed' WHERE id = $1`,
        [orderId]
      );
    }

    logEvent('OrderPacked', {
      orderId,
      itemsPacked: result.rows.length,
      allPacked,
      packedBy
    });

    return { success: true, itemsPacked: result.rows.length, allPacked };
  }

  /**
   * Ship order - create shipment and update statuses
   */
  async shipOrder(orderId, carrierId, trackingNumber) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verify all items are packed
      const checkResult = await client.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN pack_status = 'packed' THEN 1 END) as packed
         FROM order_items WHERE order_id = $1`,
        [orderId]
      );

      const check = checkResult.rows[0];
      if (parseInt(check.total) !== parseInt(check.packed)) {
        throw new BusinessLogicError('Not all items are packed yet');
      }

      // Get order details
      const orderResult = await client.query(
        `SELECT * FROM orders WHERE id = $1`,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        throw new NotFoundError('Order not found');
      }

      const order = orderResult.rows[0];

      // Get warehouse from first order item
      const warehouseResult = await client.query(
        `SELECT warehouse_id FROM order_items WHERE order_id = $1 LIMIT 1`,
        [orderId]
      );

      const warehouseId = warehouseResult.rows[0].warehouse_id;

      // Create shipment if not exists
      const shipmentResult = await client.query(
        `INSERT INTO shipments 
        (tracking_number, order_id, carrier_id, warehouse_id, status, destination_address, delivery_scheduled)
        VALUES ($1, $2, $3, $4, 'picked_up', $5, $6)
        ON CONFLICT (tracking_number) DO UPDATE SET status = 'picked_up'
        RETURNING *`,
        [
          trackingNumber,
          orderId,
          carrierId,
          warehouseId,
          order.shipping_address,
          order.estimated_delivery
        ]
      );

      // Update order items ship status
      await client.query(
        `UPDATE order_items
         SET ship_status = 'shipped', shipped_at = NOW()
         WHERE order_id = $1`,
        [orderId]
      );

      // Update order status
      await client.query(
        `UPDATE orders SET status = 'shipped' WHERE id = $1`,
        [orderId]
      );

      await client.query('COMMIT');

      logEvent('OrderShipped', {
        orderId,
        trackingNumber,
        carrierId
      });

      return shipmentResult.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get pick list by ID with items
   */
  async getPickList(pickListId) {
    const pickListResult = await pool.query(
      `SELECT pl.*, w.name as warehouse_name, u.name as assigned_to_name
       FROM pick_lists pl
       JOIN warehouses w ON w.id = pl.warehouse_id
       LEFT JOIN users u ON u.id = pl.assigned_to
       WHERE pl.id = $1`,
      [pickListId]
    );

    if (pickListResult.rows.length === 0) {
      throw new NotFoundError('Pick list not found');
    }

    const pickList = pickListResult.rows[0];

    // Get items
    const itemsResult = await pool.query(
      `SELECT pli.*, p.name as product_name, p.sku, oi.order_id
       FROM pick_list_items pli
       JOIN products p ON p.id = pli.product_id
       JOIN order_items oi ON oi.id = pli.order_item_id
       WHERE pli.pick_list_id = $1
       ORDER BY pli.location, p.sku`,
      [pickListId]
    );

    pickList.items = itemsResult.rows;

    return pickList;
  }

  /**
   * Get pending pick lists for a warehouse
   */
  async getPendingPickLists(warehouseId) {
    const result = await pool.query(
      `SELECT pl.*, u.name as assigned_to_name
       FROM pick_lists pl
       LEFT JOIN users u ON u.id = pl.assigned_to
       WHERE pl.warehouse_id = $1 AND pl.status IN ('pending', 'in_progress')
       ORDER BY pl.priority ASC, pl.created_at ASC`,
      [warehouseId]
    );

    return result.rows;
  }
}

export default new WarehouseOpsService();
