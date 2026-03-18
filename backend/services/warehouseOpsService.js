// Warehouse Operations Service - Pick, Pack, Ship workflows
import { NotFoundError, BusinessLogicError } from '../errors/index.js';
import { logEvent } from '../utils/logger.js';
import { withTransaction } from '../utils/dbTransaction.js';
import warehouseOpsRepo from '../repositories/WarehouseOpsRepository.js';
import orderService from './orderService.js';

class WarehouseOpsService {
  /**
   * Create pick list for orders ready to be picked
   */
  async createPickList(warehouseId, orderIds, assignedTo) {
    try {
      const pickList = await withTransaction(async (tx) => {
        // Generate pick list number
        const pickListNumber = `PL-${Date.now()}`;

        // Get order items for the orders at this warehouse
        const items = await warehouseOpsRepo.findPendingOrderItemsForWarehouse(warehouseId, orderIds, tx);

        if (items.length === 0) {
          throw new BusinessLogicError('No items available for picking');
        }

        // Create pick list
        const pickList = await warehouseOpsRepo.createPickList({
          pickListNumber,
          warehouseId,
          assignedTo,
          totalItems: items.length
        }, tx);

        // Add items to pick list
        for (const item of items) {
          await warehouseOpsRepo.createPickListItem({
            pickListId: pickList.id,
            orderItemId: item.id,
            productId: item.product_id,
            quantityRequired: item.quantity,
            location: 'A1-B2'
          }, tx);

          // Update order item status
          await warehouseOpsRepo.updateOrderItemPickStatus(item.id, 'assigned', tx);
        }

        return pickList;
      });

      logEvent('PickListCreated', {
        pickListId: pickList.id,
        pickListNumber: pickList.pick_list_number,
        warehouseId,
        itemsCount: pickList.total_items
      });

      return pickList;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Start picking process
   */
  async startPicking(pickListId, userId) {
    const result = await warehouseOpsRepo.startPickList(pickListId);

    if (!result) {
      throw new NotFoundError('Pick list not found or already started');
    }

    logEvent('PickingStarted', { pickListId, userId });
    return result;
  }

  /**
   * Mark item as picked
   */
  async pickItem(pickListItemId, quantityPicked, pickedBy) {
    return withTransaction(async (tx) => {

      // Get pick list item
      const item = await warehouseOpsRepo.findPickListItemWithOrderItem(pickListItemId, tx);

      if (!item) {
        throw new NotFoundError('Pick list item not found');
      }
      const status = quantityPicked >= item.quantity_required ? 'picked' : 'short_picked';

      // Update pick list item
      await warehouseOpsRepo.updatePickListItemPicked(pickListItemId, quantityPicked, status, tx);

      // Update order item
      await warehouseOpsRepo.markOrderItemPicked(item.order_item_id, status, pickedBy, tx);

      // Update pick list progress
      await warehouseOpsRepo.incrementPickedItems(item.pick_list_id, tx);

      // Check if pick list is complete
      const progress = await warehouseOpsRepo.findPickListProgress(item.pick_list_id, tx);

      if (progress.picked_items >= progress.total_items) {
        await warehouseOpsRepo.completePickList(item.pick_list_id, tx);
      }


      logEvent('ItemPicked', {
        pickListItemId,
        quantityPicked,
        status
      });

      return { success: true, status };

    });
  }

  /**
   * Pack order items
   */
  async packOrder(orderId, packedBy) {
    const packedItems = await warehouseOpsRepo.packOrderItems(orderId, packedBy);

    if (packedItems.length === 0) {
      throw new BusinessLogicError('No items ready for packing or already packed');
    }

    // Check if all items are packed
    const check = await warehouseOpsRepo.getPackingProgress(orderId);
    const allPacked = parseInt(check.total, 10) === parseInt(check.packed, 10);

    if (allPacked) {
      await warehouseOpsRepo.updateOrderStatus(orderId, 'packed');
    }

    logEvent('OrderPacked', {
      orderId,
      itemsPacked: packedItems.length,
      allPacked,
      packedBy
    });

    return { success: true, itemsPacked: packedItems.length, allPacked };
  }

  /**
   * Ship order - create shipment and update statuses
   */
  async shipOrder(orderId, carrierId, trackingNumber) {
    return withTransaction(async (tx) => {

      // Verify all items are packed
      const check = await warehouseOpsRepo.countPackedVsTotal(orderId, tx);
      if (parseInt(check.total, 10) !== parseInt(check.packed, 10)) {
        throw new BusinessLogicError('Not all items are packed yet');
      }

      // Get order details
      const order = await warehouseOpsRepo.findOrderById(orderId, tx);
      if (!order) {
        throw new NotFoundError('Order not found');
      }

      // Get warehouse from first order item
      const warehouseId = await warehouseOpsRepo.findWarehouseIdForOrder(orderId, tx);

      // Create shipment if not exists
      const shipment = await warehouseOpsRepo.upsertShipment({
        trackingNumber,
        orderId,
        carrierId,
        warehouseId,
        destinationAddress: order.shipping_address,
        deliveryScheduled: order.estimated_delivery
      }, tx);

      // Update order items ship status
      await warehouseOpsRepo.markOrderItemsShipped(orderId, tx);

      // Update order status
      await warehouseOpsRepo.updateOrderStatus(orderId, 'shipped', tx);

      // Deduct stock from inventory and refresh warehouse utilization
      await orderService.commitOrderStock(orderId, tx);

      logEvent('OrderShipped', {
        orderId,
        trackingNumber,
        carrierId
      });

      return shipment;

    });
  }

  /**
   * Get pick list by ID with items
   */
  async getPickList(pickListId) {
    const pickList = await warehouseOpsRepo.findPickListById(pickListId);

    if (!pickList) {
      throw new NotFoundError('Pick list not found');
    }

    // Get items
    pickList.items = await warehouseOpsRepo.findPickListItems(pickListId);

    return pickList;
  }

  /**
   * Get pending pick lists for a warehouse
   */
  async getPendingPickLists(warehouseId) {
    return warehouseOpsRepo.findPendingPickLists(warehouseId);
  }
}

export default new WarehouseOpsService();
