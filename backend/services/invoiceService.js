// Invoice Service - Automated invoice generation and billing
import pool from '../configs/db.js';
import { NotFoundError } from '../errors/index.js';
import { logEvent } from '../utils/logger.js';

class InvoiceService {
  /**
   * Generate invoice for carrier for a billing period
   * Includes shipments, penalties, adjustments
   */
  async generateInvoiceForCarrier(carrierId, billingPeriodStart, billingPeriodEnd, jobId = null) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get carrier info
      const carrierResult = await client.query(
        'SELECT * FROM carriers WHERE id = $1',
        [carrierId]
      );

      if (carrierResult.rows.length === 0) {
        throw new NotFoundError('Carrier not found');
      }

      const carrier = carrierResult.rows[0];

      // Get all shipments for this carrier in the period
      const shipmentsResult = await client.query(
        `SELECT s.*, o.order_number
         FROM shipments s
         JOIN orders o ON o.id = s.order_id
         WHERE s.carrier_id = $1
         AND s.created_at >= $2
         AND s.created_at < $3
         AND s.status IN ('delivered', 'returned')
         ORDER BY s.created_at`,
        [carrierId, billingPeriodStart, billingPeriodEnd]
      );

      const shipments = shipmentsResult.rows;

      if (shipments.length === 0) {
        logEvent('InvoiceGenerationSkipped', {
          carrierId,
          carrier: carrier.name,
          reason: 'No completed shipments in period'
        });
        await client.query('ROLLBACK');
        return null;
      }

      // Calculate base shipping costs
      let baseAmount = 0;
      const shipmentLineItems = [];

      for (const shipment of shipments) {
        const shippingCost = parseFloat(shipment.shipping_cost) || 0;
        baseAmount += shippingCost;

        shipmentLineItems.push({
          shipmentId: shipment.id,
          description: `Shipment ${shipment.tracking_number} - Order ${shipment.order_number}`,
          itemType: 'shipping_fee',
          quantity: 1,
          unitPrice: shippingCost,
          amount: shippingCost
        });
      }

      // Get SLA penalties for this period
      const penaltiesResult = await client.query(
        `SELECT sv.*, s.tracking_number
         FROM sla_violations sv
         JOIN shipments s ON s.id = sv.shipment_id
         WHERE s.carrier_id = $1
         AND sv.created_at >= $2
         AND sv.created_at < $3
         AND sv.penalty_applied = true`,
        [carrierId, billingPeriodStart, billingPeriodEnd]
      );

      let totalPenalties = 0;
      const penaltyLineItems = [];

      for (const penalty of penaltiesResult.rows) {
        const penaltyAmount = parseFloat(penalty.penalty_amount) || 0;
        totalPenalties += penaltyAmount;

        penaltyLineItems.push({
          shipmentId: penalty.shipment_id,
          description: `SLA Penalty - ${penalty.tracking_number} (${penalty.delay_hours}h delay)`,
          itemType: 'penalty',
          quantity: 1,
          unitPrice: -penaltyAmount,
          amount: -penaltyAmount
        });
      }

      // Calculate fuel surcharge (example: 5% of base)
      const fuelSurcharge = baseAmount * 0.05;
      const fuelLineItem = {
        shipmentId: null,
        description: 'Fuel Surcharge (5%)',
        itemType: 'fuel_surcharge',
        quantity: 1,
        unitPrice: fuelSurcharge,
        amount: fuelSurcharge
      };

      // Calculate final amount
      const finalAmount = baseAmount + fuelSurcharge - totalPenalties;

      // Generate invoice number
      const invoiceNumber = `INV-${carrier.code}-${Date.now()}`;

      // Calculate payment due date (30 days from end of period)
      const paymentDueDate = new Date(billingPeriodEnd);
      paymentDueDate.setDate(paymentDueDate.getDate() + 30);

      // Create invoice
      const invoiceResult = await client.query(
        `INSERT INTO invoices 
        (invoice_number, carrier_id, billing_period_start, billing_period_end,
         total_shipments, base_amount, penalties, adjustments, final_amount,
         status, auto_generated, generation_job_id, payment_due_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', true, $10, $11)
        RETURNING *`,
        [
          invoiceNumber,
          carrierId,
          billingPeriodStart,
          billingPeriodEnd,
          shipments.length,
          baseAmount,
          totalPenalties,
          fuelSurcharge,
          finalAmount,
          jobId,
          paymentDueDate
        ]
      );

      const invoice = invoiceResult.rows[0];

      // Insert all line items
      const allLineItems = [...shipmentLineItems, ...penaltyLineItems, fuelLineItem];

      for (const lineItem of allLineItems) {
        await client.query(
          `INSERT INTO invoice_line_items 
          (invoice_id, shipment_id, description, item_type, quantity, unit_price, amount)
          VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            invoice.id,
            lineItem.shipmentId,
            lineItem.description,
            lineItem.itemType,
            lineItem.quantity,
            lineItem.unitPrice,
            lineItem.amount
          ]
        );
      }

      await client.query('COMMIT');

      logEvent('InvoiceGenerated', {
        invoiceId: invoice.id,
        invoiceNumber,
        carrierId,
        carrierName: carrier.name,
        billingPeriod: `${billingPeriodStart} to ${billingPeriodEnd}`,
        totalShipments: shipments.length,
        finalAmount,
        autoGenerated: true
      });

      return invoice;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Generate invoices for all active carriers
   * Typically run monthly as a background job
   */
  async generateMonthlyInvoices(month, year) {
    // Calculate billing period
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 1);

    // Get all active carriers
    const carriersResult = await pool.query(
      'SELECT id FROM carriers WHERE is_active = true'
    );

    const invoices = [];
    const errors = [];

    for (const carrier of carriersResult.rows) {
      try {
        const invoice = await this.generateInvoiceForCarrier(
          carrier.id,
          periodStart.toISOString(),
          periodEnd.toISOString()
        );

        if (invoice) {
          invoices.push(invoice);
        }
      } catch (error) {
        errors.push({
          carrierId: carrier.id,
          error: error.message
        });
      }
    }

    logEvent('MonthlyInvoicesGenerated', {
      month,
      year,
      totalInvoices: invoices.length,
      errors: errors.length
    });

    return {
      invoices,
      errors,
      summary: {
        generated: invoices.length,
        failed: errors.length,
        totalAmount: invoices.reduce((sum, inv) => sum + parseFloat(inv.final_amount), 0)
      }
    };
  }

  /**
   * Get invoice with line items
   */
  async getInvoiceWithLineItems(invoiceId) {
    const invoiceResult = await pool.query(
      `SELECT i.*, c.name as carrier_name, c.code as carrier_code
       FROM invoices i
       LEFT JOIN carriers c ON c.id = i.carrier_id
       WHERE i.id = $1`,
      [invoiceId]
    );

    if (invoiceResult.rows.length === 0) {
      throw new NotFoundError('Invoice not found');
    }

    const invoice = invoiceResult.rows[0];

    // Get line items
    const lineItemsResult = await pool.query(
      `SELECT * FROM invoice_line_items
       WHERE invoice_id = $1
       ORDER BY item_type, created_at`,
      [invoiceId]
    );

    invoice.lineItems = lineItemsResult.rows;

    return invoice;
  }

  /**
   * Approve invoice
   */
  async approveInvoice(invoiceId, approvedBy) {
    const result = await pool.query(
      `UPDATE invoices
       SET status = 'approved',
           approved_at = NOW(),
           approved_by = $1
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [approvedBy, invoiceId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Invoice not found or already processed');
    }

    logEvent('InvoiceApproved', {
      invoiceId,
      invoiceNumber: result.rows[0].invoice_number,
      approvedBy
    });

    return result.rows[0];
  }

  /**
   * Mark invoice as paid
   */
  async markInvoicePaid(invoiceId, paymentMethod, paymentDate) {
    const result = await pool.query(
      `UPDATE invoices
       SET status = 'paid',
           payment_method = $1,
           payment_received_date = $2
       WHERE id = $3 AND status = 'approved'
       RETURNING *`,
      [paymentMethod, paymentDate, invoiceId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Invoice not found or not approved');
    }

    logEvent('InvoicePaid', {
      invoiceId,
      invoiceNumber: result.rows[0].invoice_number,
      paymentMethod,
      amount: result.rows[0].final_amount
    });

    return result.rows[0];
  }

  /**
   * Dispute invoice
   */
  async disputeInvoice(invoiceId, reason, disputedBy) {
    const result = await pool.query(
      `UPDATE invoices
       SET status = 'disputed'
       WHERE id = $1
       RETURNING *`,
      [invoiceId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Invoice not found');
    }

    logEvent('InvoiceDisputed', {
      invoiceId,
      invoiceNumber: result.rows[0].invoice_number,
      reason,
      disputedBy
    });

    return result.rows[0];
  }

  /**
   * Get invoicing summary for a period
   */
  async getInvoicingSummary(startDate, endDate) {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_invoices,
        SUM(total_shipments) as total_shipments,
        SUM(base_amount) as total_base_amount,
        SUM(penalties) as total_penalties,
        SUM(adjustments) as total_adjustments,
        SUM(final_amount) as total_final_amount,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid,
        COUNT(CASE WHEN status = 'disputed' THEN 1 END) as disputed
       FROM invoices
       WHERE created_at >= $1 AND created_at < $2`,
      [startDate, endDate]
    );

    return result.rows[0];
  }
}

export default new InvoiceService();
