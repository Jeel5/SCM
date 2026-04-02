// Customer Invoice Service - Auto-generates customer invoices when orders complete
import { withTransaction } from '../utils/dbTransaction.js';
import financeRepo from '../repositories/FinanceRepository.js';
import OrderRepository from '../repositories/OrderRepository.js';
import logger from '../utils/logger.js';

class CustomerInvoiceService {
  /**
   * Generate a customer invoice when an order is fulfilled/delivered
   * Called when order reaches 'delivered' status
   */
  async generateInvoiceForDeliveredOrder(orderId, organizationId, tx = null) {
    const task = async (client) => {
      // Fetch order details
      const order = await OrderRepository.findById(orderId, organizationId, client);
      if (!order) {
        logger.warn(`Order ${orderId} not found for invoice generation`);
        return null;
      }

      // Check if invoice already exists for this order
      const existing = await financeRepo.query(
        `SELECT id FROM invoices WHERE order_id = $1 AND invoice_type = 'customer'`,
        [orderId],
        client
      );

      if (existing.rows.length > 0) {
        logger.debug(`Invoice already exists for order ${orderId}`);
        return existing.rows[0];
      }

      // Generate unique invoice number
      const timestamp = Date.now().toString(36).toUpperCase();
      const invoiceNumber = `CUST-${order.order_number}-${timestamp}`;

      // Calculate due date (30 days from now)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      // Create customer invoice
      const invoice = await financeRepo.createCustomerInvoice(
        {
          organizationId,
          invoiceNumber,
          customerId: null,
          orderId,
          totalAmount: parseFloat(order.total_amount) || 0,
          taxAmount: 0, // Can be calculated if tax data exists
          finalAmount: parseFloat(order.total_amount) || 0,
          status: 'pending',
          dueDate: dueDate.toISOString().split('T')[0],
        },
        client
      );

      logger.info('Customer invoice generated', {
        invoiceId: invoice.id,
        invoiceNumber,
        orderId,
        orderNumber: order.order_number,
        customerId: null,
        amount: invoice.final_amount,
      });

      return invoice;
    };

    if (tx) {
      return task(tx);
    } else {
      return withTransaction(task);
    }
  }

  /**
   * Batch generate invoices for all orders delivered in a date range
   * Useful for background job processing or reconciliation
   */
  async generateBatchInvoices(startDate, endDate, organizationId = undefined) {
    const orders = await OrderRepository.findOrdersByStatusAndDateRange(
      'delivered',
      startDate,
      endDate,
      organizationId
    );

    const results = {
      generated: 0,
      skipped: 0,
      errors: 0,
      invoices: [],
    };

    for (const order of orders) {
      try {
        const invoice = await this.generateInvoiceForDeliveredOrder(
          order.id,
          order.organization_id
        );
        if (invoice) {
          results.generated++;
          results.invoices.push(invoice);
        } else {
          results.skipped++;
        }
      } catch (error) {
        results.errors++;
        logger.error('Error generating invoice for order', { orderId: order.id, error: error.message });
      }
    }

    return results;
  }
}

export default new CustomerInvoiceService();
