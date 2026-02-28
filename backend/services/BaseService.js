/**
 * Base Service
 *
 * Provides a thin wrapper around the shared connection pool so that all
 * service classes share a consistent query/transaction API — the same pattern
 * used in BaseRepository.
 *
 * Usage:
 *   import BaseService from './BaseService.js';
 *
 *   class MyService extends BaseService {
 *     async doWork(id) {
 *       const result = await this.query('SELECT * FROM my_table WHERE id = $1', [id]);
 *       return result.rows[0];
 *     }
 *
 *     async doTransactionalWork(a, b) {
 *       return this.withTransaction(async (tx) => {
 *         await tx.query('INSERT INTO t VALUES ($1)', [a]);
 *         await tx.query('INSERT INTO t VALUES ($1)', [b]);
 *       });
 *     }
 *   }
 *
 *   export default new MyService();
 */

import pool from '../config/db.js';
import { withTransaction, withTransactionRetry } from '../utils/dbTransaction.js';

export class BaseService {
  constructor() {
    /** Exposed so subclasses can pass the pool to helpers that need it. */
    this.pool = pool;
  }

  /**
   * Execute a parameterised SQL query.
   *
   * @param {string} text   - SQL query string with positional placeholders ($1, $2 …)
   * @param {Array}  params - Bound parameter values
   * @param {import('pg').PoolClient|null} client
   *   Optional pg client from an active `withTransaction` callback — pass `tx`
   *   when you need the query to participate in the same transaction.
   * @returns {Promise<import('pg').QueryResult>}
   */
  async query(text, params, client = null) {
    const db = client || this.pool;
    return db.query(text, params);
  }

  /**
   * Execute `fn` inside a database transaction.
   *
   * `withTransaction` automatically handles BEGIN / COMMIT / ROLLBACK and
   * releases the client back to the pool.  Callers never need `pool.connect()`.
   *
   * @template T
   * @param {(tx: import('pg').PoolClient) => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async withTransaction(fn) {
    return withTransaction(fn);
  }

  /**
   * Like `withTransaction` but retries on serialisation failures (error code
   * 40001) up to `options.maxRetries` times (default 3).
   *
   * @template T
   * @param {(tx: import('pg').PoolClient) => Promise<T>} fn
   * @param {{ maxRetries?: number, retryDelay?: number }} [options]
   * @returns {Promise<T>}
   */
  async withTransactionRetry(fn, options = {}) {
    return withTransactionRetry(fn, options);
  }
}

export default BaseService;
