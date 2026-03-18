// Allocation Service - Intelligent inventory allocation across warehouses
import { withTransaction } from '../utils/dbTransaction.js';
import { BusinessLogicError } from '../errors/index.js';
import { logEvent } from '../utils/logger.js';
import shipmentRepo from '../repositories/ShipmentRepository.js';
import inventoryRepo from '../repositories/InventoryRepository.js';
import allocationRepo from '../repositories/AllocationRepository.js';

function runSerial(items, worker) {
  return items.reduce(
    (chain, item) => chain.then(() => worker(item)),
    Promise.resolve()
  );
}

class AllocationService {
  /**
   * Allocate inventory for order items across available warehouses
   * Uses allocation rules to determine optimal warehouse selection
   */
  async allocateOrderItems(orderId, items, shippingAddress) {
    return withTransaction(async (tx) => {
      const allocations = [];

      // Get active allocation rules sorted by priority
      const rules = await allocationRepo.findActiveRules(tx);

      await runSerial(items, async (item) => {
        const allocation = await this.allocateItem(item, shippingAddress, rules, tx);
        allocations.push(allocation);

        // Record allocation history inside the same transaction
        await allocationRepo.insertAllocationHistory({
          orderId,
          orderItemId: item.id,
          warehouseId: allocation.warehouseId,
          allocationStrategy: allocation.strategy,
          allocationScore: allocation.score,
          allocatedQuantity: item.quantity,
          reason: allocation.reason
        }, tx);
      });

      logEvent('InventoryAllocated', { orderId, allocationsCount: allocations.length });
      return allocations;
    });
  }

  /**
   * Allocate a single item to the best warehouse
   */
  async allocateItem(item, shippingAddress, rules, tx = null) {
    // FOR UPDATE locks matching inventory rows for the duration of the transaction,
    // preventing two concurrent allocations from selecting the same warehouse stock.
    const warehouses = await allocationRepo.findWarehousesWithInventoryForSku(item.sku, item.quantity, tx);

    if (warehouses.length === 0) {
      throw new BusinessLogicError(`No warehouse has sufficient stock for SKU: ${item.sku}`);
    }

    // Score each warehouse based on allocation rules
    const scoredWarehouses = await Promise.all(
      warehouses.map(wh => this.scoreWarehouse(wh, item, shippingAddress, rules))
    );

    // Select warehouse with highest score
    const bestWarehouse = scoredWarehouses.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    // Reserve inventory in the chosen warehouse (decrement available, increment reserved)
    const reserved = await allocationRepo.reserveInventoryForWarehouse(item.quantity, bestWarehouse.id, item.sku, tx);

    if (!reserved) {
      throw new BusinessLogicError(
        `Failed to reserve inventory for SKU ${item.sku} at warehouse ${bestWarehouse.name} — stock may have changed`
      );
    }

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

    await runSerial(rules, async (rule) => {
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
    });

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
    const { total, on_time } = await shipmentRepo.getWarehouseOnTimeRate(warehouse.id);
    if (total === 0) return 75; // Default for new warehouses
    return (on_time / total) * 100;
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
    const counts = await Promise.all(
      items.map((item) => inventoryRepo.countWarehousesWithStock(item.sku, item.quantity))
    );
    return counts.some((count) => count === 0);
  }

  /**
   * Split order items across multiple warehouses
   */
  async splitOrderAcrossWarehouses(orderId, items, shippingAddress) {
    const splits = {};

    await runSerial(items, async (item) => {
      const warehouses = await inventoryRepo.findWarehousesWithStockBySku(item.sku);
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
    });

    logEvent('OrderSplit', { 
      orderId, 
      warehouseCount: Object.keys(splits).length,
      reason: 'Insufficient stock in single warehouse'
    });

    return Object.values(splits);
  }
}

export default new AllocationService();
