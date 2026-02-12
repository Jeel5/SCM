// Database transaction utility - ensures atomic operations with automatic rollback on failure
import pool from '../configs/db.js';
import logger from './logger.js';

/**
 * Transaction wrapper class for managing database transactions
 */
export class Transaction {
  constructor() {
    this.client = null;
    this.isActive = false;
  }

  /**
   * Begin a new transaction
   */
  async begin() {
    if (this.isActive) {
      throw new Error('Transaction already active');
    }
    
    this.client = await pool.connect();
    await this.client.query('BEGIN');
    this.isActive = true;
    logger.debug('Transaction started');
  }

  /**
   * Commit the transaction
   */
  async commit() {
    if (!this.isActive) {
      throw new Error('No active transaction to commit');
    }
    
    await this.client.query('COMMIT');
    this.isActive = false;
    this.client.release();
    logger.debug('Transaction committed');
  }

  /**
   * Rollback the transaction
   */
  async rollback() {
    if (!this.isActive) {
      logger.warn('Attempted to rollback inactive transaction');
      return;
    }
    
    try {
      await this.client.query('ROLLBACK');
      logger.debug('Transaction rolled back');
    } catch (error) {
      logger.error('Error rolling back transaction', error);
    } finally {
      this.isActive = false;
      if (this.client) {
        this.client.release();
      }
    }
  }

  /**
   * Execute a query within the transaction
   */
  async query(sql, params) {
    if (!this.isActive) {
      throw new Error('No active transaction');
    }
    return this.client.query(sql, params);
  }

  /**
   * Get the underlying client for complex operations
   */
  getClient() {
    if (!this.isActive) {
      throw new Error('No active transaction');
    }
    return this.client;
  }
}

/**
 * Execute a callback within a transaction
 * Automatically commits on success or rolls back on error
 * 
 * @param {Function} callback - Async function that receives transaction object
 * @returns {Promise} Result of the callback
 * 
 * @example
 * const result = await withTransaction(async (tx) => {
 *   const order = await tx.query('INSERT INTO orders...');
 *   const items = await tx.query('INSERT INTO order_items...');
 *   return order;
 * });
 */
export async function withTransaction(callback) {
  const transaction = new Transaction();
  
  try {
    await transaction.begin();
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    logger.error('Transaction failed and rolled back', { 
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
}

/**
 * Execute multiple operations in a transaction with retry logic
 * 
 * @param {Function} callback - Async function that receives transaction object
 * @param {Object} options - Retry options
 * @returns {Promise} Result of the callback
 */
export async function withTransactionRetry(callback, options = {}) {
  const { maxRetries = 3, retryDelay = 1000 } = options;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await withTransaction(callback);
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable (deadlock, serialization failure)
      const isRetryable = error.code === '40P01' || // deadlock_detected
                          error.code === '40001' || // serialization_failure
                          error.message.includes('deadlock');
      
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      
      logger.warn(`Transaction failed (attempt ${attempt}/${maxRetries}), retrying...`, {
        error: error.message,
        code: error.code
      });
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
    }
  }
  
  throw lastError;
}

export default {
  Transaction,
  withTransaction,
  withTransactionRetry
};
