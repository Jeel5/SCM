/**
 * Example: How to integrate carrier rates with order creation
 * 
 * This shows how to modify your existing order creation to include
 * carrier rate fetching and selection.
 */

import carrierRateService from '../services/carrierRateService.js';
import db from '../configs/db.js';
import logger from '../utils/logger.js';

/**
 * Example function showing how to create an order with carrier selection
 */
export async function createOrderWithCarrierSelection(orderData) {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Create the order first
    const orderResult = await client.query(
      `INSERT INTO orders (customer_id, warehouse_id, status, total_amount)
       VALUES ($1, $2, 'pending', $3)
       RETURNING id`,
      [orderData.customerId, orderData.warehouseId, orderData.totalAmount]
    );

    const orderId = orderResult.rows[0].id;

    // 2. Insert order items
    for (const item of orderData.items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price, weight, dimensions, is_fragile)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orderId, item.productId, item.quantity, item.price, item.weight, 
         JSON.stringify(item.dimensions), item.isFragile]
      );
    }

    // 3. Get warehouse location
    const warehouseResult = await client.query(
      `SELECT name, address, latitude, longitude, postal_code 
       FROM warehouses WHERE id = $1`,
      [orderData.warehouseId]
    );

    const warehouse = warehouseResult.rows[0];

    // 4. Prepare shipment details for carrier quotes
    const shipmentDetails = {
      origin: {
        lat: warehouse.latitude,
        lon: warehouse.longitude,
        address: `${warehouse.name}, ${warehouse.address}`,
        postalCode: warehouse.postal_code
      },
      destination: {
        lat: orderData.deliveryAddress.latitude,
        lon: orderData.deliveryAddress.longitude,
        address: orderData.deliveryAddress.fullAddress,
        postalCode: orderData.deliveryAddress.postalCode
      },
      items: orderData.items.map(item => ({
        weight: item.weight,
        dimensions: item.dimensions,
        is_fragile: item.isFragile,
        requires_cold_storage: item.requiresColdStorage || false
      })),
      orderId
    };

    logger.info('Fetching carrier quotes for new order', { orderId });

    // 5. Get quotes from all carriers
    const quotes = await carrierRateService.getQuotesFromAllCarriers(shipmentDetails);

    if (quotes.length === 0) {
      throw new Error('No carrier quotes available');
    }

    // 6. Select best carrier based on criteria
    // You can customize criteria based on customer preference or order priority
    const criteria = orderData.expressDelivery ? {
      prioritizePrice: 0.3,
      prioritizeSpeed: 0.6,
      reliabilityWeight: 0.1
    } : {
      prioritizePrice: 0.6,
      prioritizeSpeed: 0.2,
      reliabilityWeight: 0.2
    };

    const selectedQuote = carrierRateService.selectBestQuote(quotes, criteria);

    logger.info('Selected carrier for order', {
      orderId,
      carrier: selectedQuote.carrierName,
      price: selectedQuote.quotedPrice,
      deliveryDays: selectedQuote.estimatedDeliveryDays
    });

    // 7. Mark the selected quote
    await carrierRateService.markQuoteAsSelected(
      selectedQuote.carrierId, // This should be quote ID, fix needed
      orderId
    );

    // 8. Update order with selected carrier and shipping cost
    await client.query(
      `UPDATE orders 
       SET carrier_id = $1, 
           shipping_cost = $2,
           estimated_delivery_date = $3
       WHERE id = $4`,
      [
        selectedQuote.carrierId,
        selectedQuote.quotedPrice,
        selectedQuote.estimatedDeliveryDate,
        orderId
      ]
    );

    // 9. Create carrier assignment
    await client.query(
      `INSERT INTO carrier_assignments 
       (order_id, carrier_id, status, request_payload, assigned_at)
       VALUES ($1, $2, 'pending', $3, NOW())`,
      [
        orderId,
        selectedQuote.carrierId,
        JSON.stringify({
          orderData: orderData,
          quote: selectedQuote,
          pickup: shipmentDetails.origin,
          delivery: shipmentDetails.destination
        })
      ]
    );

    await client.query('COMMIT');

    logger.info('Order created successfully with carrier selection', { orderId });

    return {
      orderId,
      selectedCarrier: selectedQuote.carrierName,
      shippingCost: selectedQuote.quotedPrice,
      estimatedDeliveryDays: selectedQuote.estimatedDeliveryDays,
      allQuotes: quotes.map(q => ({
        carrier: q.carrierName,
        price: q.quotedPrice,
        days: q.estimatedDeliveryDays
      }))
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to create order with carrier selection', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Example function for e-commerce checkout - get shipping costs before order creation
 */
export async function getCheckoutShippingOptions(checkoutData) {
  try {
    // This would be called when customer is at checkout, before placing order
    
    const { warehouseId, deliveryAddress, items } = checkoutData;

    // Get warehouse location
    const { rows } = await db.query(
      `SELECT name, address, latitude, longitude, postal_code 
       FROM warehouses WHERE id = $1`,
      [warehouseId]
    );

    if (rows.length === 0) {
      throw new Error('Warehouse not found');
    }

    const warehouse = rows[0];

    // Prepare shipment details
    const shipmentDetails = {
      origin: {
        lat: warehouse.latitude,
        lon: warehouse.longitude,
        address: `${warehouse.name}, ${warehouse.address}`,
        postalCode: warehouse.postal_code
      },
      destination: {
        lat: deliveryAddress.latitude,
        lon: deliveryAddress.longitude,
        address: deliveryAddress.fullAddress,
        postalCode: deliveryAddress.postalCode
      },
      items: items.map(item => ({
        weight: item.weight,
        dimensions: item.dimensions,
        is_fragile: item.isFragile,
        requires_cold_storage: item.requiresColdStorage || false
      })),
      orderId: 'CHECKOUT-TEMP' // Temporary ID for checkout
    };

    // Get quotes
    const quotes = await carrierRateService.getQuotesFromAllCarriers(shipmentDetails);

    if (quotes.length === 0) {
      throw new Error('No shipping options available');
    }

    // Return formatted options for checkout page
    return quotes.map(quote => ({
      carrierId: quote.carrierId,
      carrierName: quote.carrierName,
      price: quote.quotedPrice,
      deliveryDays: quote.estimatedDeliveryDays,
      estimatedDelivery: quote.estimatedDeliveryDate,
      serviceType: quote.serviceType,
      breakdown: quote.breakdown
    })).sort((a, b) => a.price - b.price); // Sort by price

  } catch (error) {
    logger.error('Failed to get checkout shipping options', { error: error.message });
    throw error;
  }
}

/**
 * Example usage in order controller:
 * 
 * export const createOrder = async (req, res, next) => {
 *   try {
 *     const orderData = {
 *       customerId: req.user.id,
 *       warehouseId: req.body.warehouseId,
 *       items: req.body.items,
 *       deliveryAddress: req.body.deliveryAddress,
 *       totalAmount: req.body.totalAmount,
 *       expressDelivery: req.body.expressDelivery
 *     };
 * 
 *     const result = await createOrderWithCarrierSelection(orderData);
 * 
 *     res.status(201).json({
 *       success: true,
 *       message: 'Order created successfully',
 *       data: result
 *     });
 *   } catch (error) {
 *     next(error);
 *   }
 * };
 */

/**
 * Example usage in checkout API:
 * 
 * export const getShippingOptions = async (req, res, next) => {
 *   try {
 *     const options = await getCheckoutShippingOptions({
 *       warehouseId: req.body.warehouseId,
 *       deliveryAddress: req.body.deliveryAddress,
 *       items: req.body.items
 *     });
 * 
 *     res.json({
 *       success: true,
 *       data: {
 *         shippingOptions: options
 *       }
 *     });
 *   } catch (error) {
 *     next(error);
 *   }
 * };
 */
