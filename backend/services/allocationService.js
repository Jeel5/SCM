// Allocation Service - Intelligent inventory allocation across warehouses
import pool from '../configs/db.js';
import { BusinessLogicError } from '../errors/index.js';
import { logEvent } from '../utils/logger.js';

class AllocationService {
  /**
   * Allocate inventory for order items across available warehouses
   * Uses allocation rules to determine optimal warehouse selection
   */
  async allocateOrderItems(orderId, items, shippingAddress) {
    const allocations = [];
    
    // Get active allocation rules sorted by priority
    const rulesResult = await pool.query(
      'SELECT * FROM allocation_rules WHERE is_active = true ORDER BY priority ASC'
    );
    const rules = rulesResult.rows;

    for (const item of items) {
      const allocation = await this.allocateItem(item, shippingAddress, rules);
      allocations.push(allocation);
      
      // Record allocation history
      await pool.query(
        `INSERT INTO allocation_history 
        (order_id, order_item_id, warehouse_id, allocation_strategy, allocation_score, allocated_quantity, reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          orderId,
          item.id,
          allocation.warehouseId,
          allocation.strategy,
          allocation.score,
          item.quantity,
          allocation.reason
        ]
      );
    }

    logEvent('InventoryAllocated', { orderId, allocationsCount: allocations.length });
    return allocations;
  }

  /**
   * Allocate a single item to the best warehouse
   */
  async allocateItem(item, shippingAddress, rules) {
    // Get warehouses with available stock for this SKU
    const warehousesResult = await pool.query(
      `SELECT w.*, i.available_quantity, i.reserved_quantity,
              w.address->>'city' as city,
              w.address->>'state' as state
       FROM warehouses w
       JOIN inventory i ON i.warehouse_id = w.id
       JOIN products p ON p.id = i.product_id
       WHERE p.sku = $1 AND i.available_quantity >= $2 AND w.is_active = true`,
      [item.sku, item.quantity]
    );

    if (warehousesResult.rows.length === 0) {
      throw new BusinessLogicError(`No warehouse has sufficient stock for SKU: ${item.sku}`);
    }

    const warehouses = warehousesResult.rows;
    
    // Score each warehouse based on allocation rules
    const scoredWarehouses = await Promise.all(
      warehouses.map(wh => this.scoreWarehouse(wh, item, shippingAddress, rules))
    );

    // Select warehouse with highest score
    const bestWarehouse = scoredWarehouses.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    return {
      warehouseId: bestWarehouse.id,
      warehouseName: bestWarehouse.name,
      strategy: bestWarehouse.strategy,
      score: bestWarehouse.score,
      reason: bestWarehouse.reason
    };
  }

  /**
   * Score a warehouse based on various allocation strategies
   */
  async scoreWarehouse(warehouse, item, shippingAddress, rules) {
    let maxScore = 0;
    let selectedStrategy = 'default';
    let reason = '';

    for (const rule of rules) {
      let score = 0;

      switch (rule.strategy) {
        case 'proximity':
          score = await this.calculateProximityScore(warehouse, shippingAddress);
          reason = 'Closest to delivery address';
          break;

        case 'cost':
          score = await this.calculateCostScore(warehouse, item);
          reason = 'Lowest shipping cost';
          break;

        case 'sla':
          score = await this.calculateSLAScore(warehouse, shippingAddress);
          reason = 'Best SLA compliance';
          break;

        case 'stock_level':
          score = this.calculateStockScore(warehouse, item);
          reason = 'Optimal stock distribution';
          break;

        case 'round_robin':
          score = Math.random() * 100;
          reason = 'Round robin distribution';
          break;

        default:
          score = 50;
      }

      if (score > maxScore) {
        maxScore = score;
        selectedStrategy = rule.strategy;
      }
    }

    return {
      ...warehouse,
      score: maxScore,
      strategy: selectedStrategy,
      reason
    };
  }

  /**
   * Calculate proximity score based on distance (simplified - uses state matching)
   */
  async calculateProximityScore(warehouse, shippingAddress) {
    const warehouseState = warehouse.state;
    const shippingState = shippingAddress.state;

    // Same state = highest score
    if (warehouseState === shippingState) {
      return 100;
    }

    // Different state = lower score (simplified)
    // In production, use actual distance calculation
    return 50;
  }

  /**
   * Calculate cost score based on shipping rates
   */
  async calculateCostScore(warehouse, item) {
    // Simplified: warehouses with more stock are assumed to have better rates
    // In production, query actual rate cards
    const stockRatio = warehouse.available_quantity / (warehouse.available_quantity + warehouse.reserved_quantity);
    return Math.min(100, stockRatio * 100 + 20);
  }

  /**
   * Calculate SLA score based on warehouse performance
   */
  async calculateSLAScore(warehouse, shippingAddress) {
    // Query recent shipment performance from this warehouse
    const perfResult = await pool.query(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN delivery_actual <= delivery_scheduled THEN 1 END) as on_time
       FROM shipments
       WHERE warehouse_id = $1 AND status = 'delivered'
       AND created_at >= NOW() - INTERVAL '30 days'`,
      [warehouse.id]
    );

    const perf = perfResult.rows[0];
    if (perf.total === 0) return 75; // Default for new warehouses

    const onTimeRate = (parseInt(perf.on_time) / parseInt(perf.total)) * 100;
    return onTimeRate;
  }

  /**
   * Calculate stock level score - prefer warehouses with excess inventory
   */
  calculateStockScore(warehouse, item) {
    const availableRatio = warehouse.available_quantity / item.quantity;
    
    // Score higher for warehouses with 2-5x the required quantity
    if (availableRatio >= 2 && availableRatio <= 5) {
      return 100;
    } else if (availableRatio > 5) {
      return 80; // Slightly lower to distribute load
    } else {
      return 50; // Just enough stock
    }
  }

  /**
   * Check if order needs to be split across multiple warehouses
   */
  async checkOrderSplitRequired(items) {
    for (const item of items) {
      // Check if any single warehouse has enough stock
      const result = await pool.query(
        `SELECT COUNT(*) as warehouse_count
         FROM inventory i
         JOIN products p ON p.id = i.product_id
         WHERE p.sku = $1 AND i.available_quantity >= $2`,
        [item.sku, item.quantity]
      );

      if (parseInt(result.rows[0].warehouse_count) === 0) {
        // No single warehouse has enough - split required
        return true;
      }
    }

    return false;
  }

  /**
   * Split order items across multiple warehouses
   */
  async splitOrderAcrossWarehouses(orderId, items, shippingAddress) {
    const splits = {};

    for (const item of items) {
      // Get warehouses with any available stock for this SKU
      const warehousesResult = await pool.query(
        `SELECT w.*, i.available_quantity
         FROM warehouses w
         JOIN inventory i ON i.warehouse_id = w.id
         JOIN products p ON p.id = i.product_id
         WHERE p.sku = $1 AND i.available_quantity > 0 AND w.is_active = true
         ORDER BY i.available_quantity DESC`,
        [item.sku]
      );

      const warehouses = warehousesResult.rows;
      let remainingQty = item.quantity;

      for (const warehouse of warehouses) {
        if (remainingQty <= 0) break;

        const allocateQty = Math.min(remainingQty, warehouse.available_quantity);
        
        if (!splits[warehouse.id]) {
          splits[warehouse.id] = {
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            items: []
          };
        }

        splits[warehouse.id].items.push({
          ...item,
          quantity: allocateQty
        });

        remainingQty -= allocateQty;
      }

      if (remainingQty > 0) {
        throw new BusinessLogicError(
          `Insufficient total inventory for SKU: ${item.sku}. Short by ${remainingQty} units.`
        );
      }
    }

    logEvent('OrderSplit', { 
      orderId, 
      warehouseCount: Object.keys(splits).length,
      reason: 'Insufficient stock in single warehouse'
    });

    return Object.values(splits);
  }
}

export default new AllocationService();
