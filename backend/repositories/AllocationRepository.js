import BaseRepository from './BaseRepository.js';

class AllocationRepository extends BaseRepository {
  constructor() {
    super('allocation_history');
  }

  /**
   * Fetch all active allocation rules ordered by priority.
   */
  async findActiveRules(client = null) {
    const res = await this.query(
      'SELECT * FROM allocation_rules WHERE is_active = true ORDER BY priority ASC',
      [],
      client
    );
    return res.rows;
  }

  /**
   * Record a single allocation decision in history.
   */
  async insertAllocationHistory(
    { orderId, orderItemId, warehouseId, allocationStrategy, allocationScore, allocatedQuantity, reason },
    client = null
  ) {
    const res = await this.query(
      `INSERT INTO allocation_history
        (order_id, order_item_id, warehouse_id, allocation_strategy, allocation_score, allocated_quantity, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [orderId, orderItemId, warehouseId, allocationStrategy, allocationScore, allocatedQuantity, reason],
      client
    );
    return res.rows[0];
  }

  /**
   * Find warehouses that have sufficient inventory for a given SKU.
   * Locks inventory rows with FOR UPDATE … SKIP LOCKED to prevent
   * concurrent allocations from selecting the same stock.
   */
  async findWarehousesWithInventoryForSku(sku, minQty, client = null) {
    const res = await this.query(
      `SELECT w.*, i.available_quantity, i.reserved_quantity,
              w.address->>'city'  AS city,
              w.address->>'state' AS state
       FROM warehouses w
       JOIN inventory i ON i.warehouse_id = w.id
       JOIN products  p ON p.id = i.product_id
       WHERE p.sku = $1
         AND i.available_quantity >= $2
         AND w.is_active = true
       FOR UPDATE OF i SKIP LOCKED`,
      [sku, minQty],
      client
    );
    return res.rows;
  }

  /**
   * Atomically reserve inventory: decrement available_quantity and
   * increment reserved_quantity.  Returns the updated inventory row id
   * or null if the update found no matching row (race condition).
   */
  async reserveInventoryForWarehouse(quantity, warehouseId, sku, client = null) {
    const res = await this.query(
      `UPDATE inventory
       SET available_quantity = available_quantity - $1,
           reserved_quantity  = reserved_quantity  + $1,
           updated_at         = NOW()
       WHERE warehouse_id = $2
         AND product_id = (SELECT id FROM products WHERE sku = $3 LIMIT 1)
         AND available_quantity >= $1
       RETURNING id`,
      [quantity, warehouseId, sku],
      client
    );
    return res.rows[0] ?? null;
  }
}

export default new AllocationRepository();
