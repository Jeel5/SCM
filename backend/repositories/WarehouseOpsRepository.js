import BaseRepository from './BaseRepository.js';

class WarehouseOpsRepository extends BaseRepository {
  constructor() {
    super('pick_lists');
  }

  // ─── Pick list queries ────────────────────────────────────────────────────────

  /**
   * Find pending order items at a warehouse that are ready for picking.
   */
  async findPendingOrderItemsForWarehouse(warehouseId, orderIds, client = null) {
    const res = await this.query(
      `SELECT oi.*, p.name AS product_name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.warehouse_id = $1
         AND oi.order_id = ANY($2)
         AND oi.pick_status = 'pending'
       ORDER BY p.category, p.sku`,
      [warehouseId, orderIds],
      client
    );
    return res.rows;
  }

  /**
   * Insert a new pick list record.
   */
  async createPickList({ pickListNumber, warehouseId, assignedTo, totalItems }, client = null) {
    const res = await this.query(
      `INSERT INTO pick_lists
        (pick_list_number, warehouse_id, assigned_to, status, total_items)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING *`,
      [pickListNumber, warehouseId, assignedTo, totalItems],
      client
    );
    return res.rows[0];
  }

  /**
   * Insert a pick list item.
   */
  async createPickListItem({ pickListId, orderItemId, productId, quantityRequired, location }, client = null) {
    const res = await this.query(
      `INSERT INTO pick_list_items
        (pick_list_id, order_item_id, product_id, quantity_required, location, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [pickListId, orderItemId, productId, quantityRequired, location],
      client
    );
    return res.rows[0];
  }

  /**
   * Update a single order item's pick status.
   */
  async updateOrderItemPickStatus(orderItemId, pickStatus, client = null) {
    const res = await this.query(
      'UPDATE order_items SET pick_status = $1 WHERE id = $2 RETURNING *',
      [pickStatus, orderItemId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Start a pick list (pending → in_progress).
   */
  async startPickList(pickListId, client = null) {
    const res = await this.query(
      `UPDATE pick_lists
       SET status = 'in_progress', started_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [pickListId],
      client
    );
    return res.rows[0] ?? null;
  }

  // ─── Pick-item queries ────────────────────────────────────────────────────────

  /**
   * Get a pick list item joined with its order item.
   */
  async findPickListItemWithOrderItem(pickListItemId, client = null) {
    const res = await this.query(
      `SELECT pli.*, oi.id AS order_item_id, oi.quantity AS required_quantity
       FROM pick_list_items pli
       JOIN order_items oi ON oi.id = pli.order_item_id
       WHERE pli.id = $1`,
      [pickListItemId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Update quantity_picked and status on a pick list item.
   */
  async updatePickListItemPicked(pickListItemId, quantityPicked, status, client = null) {
    const res = await this.query(
      `UPDATE pick_list_items
       SET quantity_picked = $1, status = $2, picked_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [quantityPicked, status, pickListItemId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Update an order item's pick status with picker and timestamp.
   */
  async markOrderItemPicked(orderItemId, status, pickedBy, client = null) {
    const res = await this.query(
      `UPDATE order_items
       SET pick_status = $1, picked_at = NOW(), picked_by = $2
       WHERE id = $3
       RETURNING *`,
      [status, pickedBy, orderItemId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Increment the picked_items counter on a pick list.
   */
  async incrementPickedItems(pickListId, client = null) {
    const res = await this.query(
      `UPDATE pick_lists
       SET picked_items = picked_items + 1
       WHERE id = $1
       RETURNING *`,
      [pickListId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Get the total / picked progress counters for a pick list.
   */
  async findPickListProgress(pickListId, client = null) {
    const res = await this.query(
      'SELECT total_items, picked_items FROM pick_lists WHERE id = $1',
      [pickListId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Complete a pick list once all items have been picked.
   */
  async completePickList(pickListId, client = null) {
    const res = await this.query(
      `UPDATE pick_lists SET status = 'completed', completed_at = NOW() WHERE id = $1 RETURNING *`,
      [pickListId],
      client
    );
    return res.rows[0] ?? null;
  }

  // ─── Pack / Ship queries ──────────────────────────────────────────────────────

  /**
   * Mark all picked order items for an order as packed.
   */
  async packOrderItems(orderId, packedBy, client = null) {
    const res = await this.query(
      `UPDATE order_items
       SET pack_status = 'packed', packed_at = NOW(), packed_by = $1
       WHERE order_id = $2
         AND pick_status  = 'picked'
         AND pack_status  = 'pending'
       RETURNING *`,
      [packedBy, orderId],
      client
    );
    return res.rows;
  }

  /**
   * Count total and packed order items for an order.
   */
  async getPackingProgress(orderId, client = null) {
    const res = await this.query(
      `SELECT COUNT(*) AS total,
              COUNT(CASE WHEN pack_status = 'packed' THEN 1 END) AS packed
       FROM order_items
       WHERE order_id = $1`,
      [orderId],
      client
    );
    return res.rows[0];
  }

  /**
   * Verify all items for an order are packed (total === packed).
   * Used as a pre-condition before shipping.
   */
  async countPackedVsTotal(orderId, client = null) {
    return this.getPackingProgress(orderId, client);
  }

  /**
   * Get full order details (SELECT * FROM orders).
   */
  async findOrderById(orderId, client = null) {
    const res = await this.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Get the warehouse_id from the first order item for an order.
   */
  async findWarehouseIdForOrder(orderId, client = null) {
    const res = await this.query(
      'SELECT warehouse_id FROM order_items WHERE order_id = $1 LIMIT 1',
      [orderId],
      client
    );
    return res.rows[0]?.warehouse_id ?? null;
  }

  /**
   * Insert (or upsert on tracking_number) a shipment record.
   */
  async upsertShipment({ trackingNumber, orderId, carrierId, warehouseId, destinationAddress, deliveryScheduled, organizationId }, client = null) {
    const res = await this.query(
      `INSERT INTO shipments
        (tracking_number, order_id, carrier_id, warehouse_id, status, destination_address, delivery_scheduled, organization_id)
       VALUES ($1, $2, $3, $4, 'picked_up', $5, $6, $7)
       ON CONFLICT (tracking_number) DO UPDATE SET status = 'picked_up'
       RETURNING *`,
      [trackingNumber, orderId, carrierId, warehouseId, destinationAddress, deliveryScheduled, organizationId || null],
      client
    );
    return res.rows[0];
  }

  /**
   * Mark all order items for an order as shipped.
   */
  async markOrderItemsShipped(orderId, client = null) {
    const res = await this.query(
      `UPDATE order_items
       SET ship_status = 'shipped', shipped_at = NOW()
       WHERE order_id = $1
       RETURNING *`,
      [orderId],
      client
    );
    return res.rows;
  }

  /**
   * Update an order's status.
   */
  async updateOrderStatus(orderId, status, client = null) {
    const res = await this.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, orderId],
      client
    );
    return res.rows[0] ?? null;
  }

  // ─── Read queries ─────────────────────────────────────────────────────────────

  /**
   * Get a pick list with warehouse and assignee names.
   */
  async findPickListById(pickListId, client = null) {
    const res = await this.query(
      `SELECT pl.*, w.name AS warehouse_name, u.name AS assigned_to_name
       FROM pick_lists pl
       JOIN warehouses w ON w.id = pl.warehouse_id
       LEFT JOIN users u ON u.id = pl.assigned_to
       WHERE pl.id = $1`,
      [pickListId],
      client
    );
    return res.rows[0] ?? null;
  }

  /**
   * Get pick list items with product and order context.
   */
  async findPickListItems(pickListId, client = null) {
    const res = await this.query(
      `SELECT pli.*, p.name AS product_name, p.sku, oi.order_id
       FROM pick_list_items pli
       JOIN products p ON p.id = pli.product_id
       JOIN order_items oi ON oi.id = pli.order_item_id
       WHERE pli.pick_list_id = $1
       ORDER BY pli.location, p.sku`,
      [pickListId],
      client
    );
    return res.rows;
  }

  /**
   * Get pending / in-progress pick lists for a warehouse.
   */
  async findPendingPickLists(warehouseId, client = null) {
    const res = await this.query(
      `SELECT pl.*, u.name AS assigned_to_name
       FROM pick_lists pl
       LEFT JOIN users u ON u.id = pl.assigned_to
       WHERE pl.warehouse_id = $1
         AND pl.status IN ('pending', 'in_progress')
       ORDER BY pl.priority ASC, pl.created_at ASC`,
      [warehouseId],
      client
    );
    return res.rows;
  }
}

export default new WarehouseOpsRepository();
