import shipmentRepo from '../repositories/ShipmentRepository.js';
import InventoryRepository from '../repositories/InventoryRepository.js';
import WarehouseRepository from '../repositories/WarehouseRepository.js';
import { withTransaction } from '../utils/dbTransaction.js';
import logger from '../utils/logger.js';
import { NotFoundError, AppError, ConflictError, AuthorizationError } from '../errors/index.js';

// ─── Shipment State Machine ──────────────────────────────────────────────────
// Single source of truth for valid transitions. Controllers / tests import this;
// they do NOT redeclare it inline.
// Terminal states have an empty array (no further transitions allowed).
export const SHIPMENT_VALID_TRANSITIONS = {
  pending:          ['manifested', 'picked_up', 'in_transit', 'lost'],
  manifested:       ['picked_up', 'in_transit', 'lost'],
  picked_up:        ['in_transit', 'at_hub', 'failed_delivery', 'returned', 'lost'],
  in_transit:       ['at_hub', 'out_for_delivery', 'failed_delivery', 'returned', 'lost'],
  at_hub:           ['in_transit', 'out_for_delivery', 'failed_delivery', 'returned', 'lost'],
  out_for_delivery: ['delivered', 'failed_delivery', 'returned', 'lost'],
  failed_delivery:  ['out_for_delivery', 'rto_initiated', 'returned', 'lost'],
  rto_initiated:    ['returned', 'lost'],
  delivered:        [],  // terminal
  returned:         [],  // terminal
  lost:             [],  // terminal
};

class ShipmentService {
  /**
   * Get paginated shipments list for table + global status stats for cards.
   * Stats are calculated on the full dataset (no pagination).
   */
  async getShipmentsWithStats({ page = 1, limit = 20, status = null, carrier_id = null, search = null, organizationId = undefined } = {}, client = null) {
    const [{ shipments, totalCount }, statsRow] = await Promise.all([
      shipmentRepo.findShipmentsWithDetails({ page, limit, status, carrier_id, search, organizationId }, client),
      shipmentRepo.getShipmentStatusStats(organizationId, client),
    ]);

    return {
      shipments,
      totalCount,
      stats: {
        totalShipments: parseInt(statsRow.total_shipments || 0, 10),
        inTransit: parseInt(statsRow.in_transit || 0, 10),
        outForDelivery: parseInt(statsRow.out_for_delivery || 0, 10),
        delivered: parseInt(statsRow.delivered || 0, 10),
      },
    };
  }

  /**
   * Transition a shipment to a new status.
   * Validates state machine, updates shipment + shipment_events, and
   * auto-executes inventory transfer for delivered transfer orders.
   *
   * @param {string} id             - shipment id
   * @param {string} status         - target status
   * @param {object|null} location  - current GPS/address location
   * @param {string|null} notes     - event description
   * @param {string|null} organizationId
   */
  async updateStatus(id, status, location, notes, organizationId) {
    await withTransaction(async (tx) => {
      // ── State machine validation (T2-05) ────────────────────────────────
      const current = await shipmentRepo.lockForStatusUpdate(id, organizationId, tx);
      if (!current) throw new NotFoundError('Shipment');

      const currentStatus = current.status;
      const allowedTransitions = SHIPMENT_VALID_TRANSITIONS[currentStatus];
      if (allowedTransitions === undefined) {
        logger.error('Unknown shipment status in state machine', { shipmentId: id, currentStatus });
        throw new AppError(`Unknown shipment status: '${currentStatus}'`, 409);
      }
      if (!allowedTransitions.includes(status)) {
        logger.warn('Invalid shipment status transition attempted', {
          shipmentId: id,
          currentStatus,
          requestedStatus: status,
          allowedTransitions,
        });
        throw new ConflictError(
          `Invalid status transition: '${currentStatus}' → '${status}'. Allowed: ${
            allowedTransitions.length ? allowedTransitions.join(', ') : '(none — terminal state)'
          }`
        );
      }

      logger.info('Shipment status transition validated', {
        shipmentId: id,
        from: currentStatus,
        to: status,
      });
      // ────────────────────────────────────────────────────────────────────

      await shipmentRepo.setStatus(id, status, location, organizationId, tx);

      await shipmentRepo.addEvent(id, status, location, notes, tx);

      if (status === 'delivered') {
        await shipmentRepo.markDelivered(id, tx);

        // Check if this is a transfer order → auto-execute inventory transfer
        const order = await shipmentRepo.findOrderForShipment(id, tx);

        if (order?.order_type === 'transfer') {
          await this._executeTransferOrderDelivery(tx, id, order);
        }

        await shipmentRepo.markOrderDelivered(id, tx);
      }
    });
  }

  /**
   * Confirm carrier pickup — transitions shipment from pending → in_transit.
   * SLA timer is anchored to the returned pickupActual timestamp.
   *
   * @param {string} id               - shipment id
   * @param {object} pickupData       - { pickupTimestamp, driverName, vehicleNumber, pickupProofUrl, gpsLocation, notes }
   * @param {string|null} requestedCarrierId - derived from auth header / JWT / body
   * @returns {{ shipmentId, trackingNumber, status, pickupActual, orderNumber, orderStatus }}
   */
  async confirmPickup(id, pickupData, requestedCarrierId) {
    const { pickupTimestamp, driverName, vehicleNumber, pickupProofUrl, gpsLocation, notes } = pickupData;

    return await withTransaction(async (tx) => {
      const shipment = await shipmentRepo.findShipmentWithOrderAndCarrier(id, tx);
      if (!shipment) throw new NotFoundError('Shipment');

      if (shipment.carrier_id !== requestedCarrierId) {
        throw new AuthorizationError('Unauthorized: You do not own this shipment');
      }
      if (shipment.status !== 'pending') {
        throw new AppError(`Shipment already ${shipment.status}. Cannot confirm pickup.`, 400);
      }

      const actualPickupTime = pickupTimestamp ? new Date(pickupTimestamp) : new Date();

      const updatedShipment = await shipmentRepo.setPickedUp(id, actualPickupTime, gpsLocation, tx);

      const eventDescription = [
        notes || `Package picked up by ${driverName || 'driver'}`,
        driverName    ? `Driver: ${driverName}`         : null,
        vehicleNumber ? `Vehicle: ${vehicleNumber}`     : null,
        pickupProofUrl? `Proof: ${pickupProofUrl}`      : null,
      ].filter(Boolean).join(' | ');

      await shipmentRepo.addTrackingEvent({
        shipment_id: id,
        event_type: 'picked_up',
        location: gpsLocation || null,
        description: eventDescription,
        event_timestamp: actualPickupTime
      }, tx);

      await shipmentRepo.markOrderShipped(shipment.order_id, tx);

      // Customer orders should consume reserved inventory when the parcel leaves the warehouse.
      if (shipment.order_type !== 'transfer') {
        const orderItems = await shipmentRepo.findOrderItems(shipment.order_id, tx);
        const affectedWarehouses = new Set();

        for (const item of orderItems) {
          if (!item.warehouse_id || !item.sku) continue;
          const updated = await InventoryRepository.deductStock(item.sku, item.warehouse_id, item.quantity, tx);
          if (!updated) {
            throw new AppError(`Failed to consume inventory for SKU ${item.sku}`, 409);
          }
          affectedWarehouses.add(item.warehouse_id);
        }

        await Promise.all(
          [...affectedWarehouses].map((warehouseId) =>
            WarehouseRepository.refreshUtilization(warehouseId, tx).catch((error) => {
              logger.warn('refreshUtilization failed after pickup confirmation', {
                warehouseId,
                error: error.message,
              });
            })
          )
        );
      }

      logger.info('Carrier confirmed pickup', {
        shipmentId: id,
        trackingNumber: shipment.tracking_number,
        carrierId: shipment.carrier_id,
        orderId: shipment.order_id,
        pickupTime: actualPickupTime,
        driverName,
        vehicleNumber,
      });

      return {
        shipmentId:    updatedShipment.id,
        trackingNumber: updatedShipment.tracking_number,
        status:        updatedShipment.status,
        pickupActual:  updatedShipment.pickup_actual,
        orderId:       shipment.order_id,
        organizationId: shipment.organization_id || null,
        orderNumber:   shipment.order_number,
        orderStatus:   'shipped',
      };
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  /**
   * Execute inventory transfer when a transfer order shipment is delivered.
   * Runs inside the caller's transaction.
   */
  async _executeTransferOrderDelivery(tx, shipmentId, order) {
    logger.info('Transfer order delivered — executing inventory transfer', {
      orderId: order.id,
      orderNumber: order.order_number,
      shipmentId,
    });

    const items = await shipmentRepo.findOrderItems(order.id, tx);

    const shippingAddress = typeof order.shipping_address === 'string'
      ? JSON.parse(order.shipping_address)
      : order.shipping_address;

    const destWarehouse = await shipmentRepo.findWarehouseByAddress(shippingAddress, tx);
    if (!destWarehouse) {
      logger.error('Could not find destination warehouse for transfer order', { orderId: order.id, shippingAddress });
      throw new AppError('Destination warehouse not found for transfer order', 422);
    }

    const toWarehouseId   = destWarehouse.id;
    const fromWarehouseId = order.warehouse_id;

    for (const item of items) {
      await shipmentRepo.decrementInventoryReserved(item.sku, fromWarehouseId, item.quantity, tx);
      await shipmentRepo.decrementInventoryQuantity(item.sku, fromWarehouseId, item.quantity, tx);
      await shipmentRepo.insertTransferOutMovement(
        item.quantity, order.id,
        `Transfer to warehouse ${toWarehouseId} - Shipment ${shipmentId}`,
        item.sku, fromWarehouseId, tx
      );
      await shipmentRepo.upsertInventoryForTransfer(toWarehouseId, item.product_id, item.sku, item.product_name, item.quantity, tx);
      await shipmentRepo.insertTransferInMovement(
        item.quantity, order.id,
        `Transfer from warehouse ${fromWarehouseId} - Shipment ${shipmentId}`,
        item.sku, toWarehouseId, tx
      );
    }

    logger.info('Inventory transfer completed', {
      orderId: order.id,
      fromWarehouse: fromWarehouseId,
      toWarehouse: toWarehouseId,
      itemCount: itemsResult.rows.length,
    });
  }
}

export default new ShipmentService();
