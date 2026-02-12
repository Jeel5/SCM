// Base Repository - provides common CRUD operations inherited by all repositories
import pool from '../configs/db.js';
import { Transaction } from '../utils/dbTransaction.js';

class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
    this.pool = pool;
  }

  // Execute SQL query with optional transaction client or Transaction instance
  async query(text, params, client = null) {
    // Support both Transaction class and raw client
    if (client instanceof Transaction) {
      return await client.query(text, params);
    }
    const db = client || this.pool;
    return await db.query(text, params);
  }

  // Get client from Transaction or return as-is
  _getClient(txOrClient) {
    if (txOrClient instanceof Transaction) {
      return txOrClient.getClient();
    }
    return txOrClient;
  }

  // Find all records with optional filtering, sorting, and pagination
  async findAll(conditions = {}, options = {}, client = null) {
    const { limit = 50, offset = 0, orderBy = 'created_at', order = 'DESC' } = options;
    
    let query = `SELECT * FROM ${this.tableName}`;
    const params = [];
    let paramCount = 1;

    // Add WHERE conditions
    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map(key => `${key} = $${paramCount++}`)
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
      params.push(...Object.values(conditions));
    }

    // Add ORDER BY
    query += ` ORDER BY ${orderBy} ${order}`;

    // Add LIMIT and OFFSET
    query += ` LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    return result.rows;
  }

  /**
   * Find a single record by ID
   */
  async findById(id, client = null) {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    const result = await this.query(query, [id], client);
    return result.rows[0] || null;
  }

  // Find single record matching conditions
  async findOne(conditions, client = null) {
    const keys = Object.keys(conditions);
    const whereClause = keys.map((key, idx) => `${key} = $${idx + 1}`).join(' AND ');
    const query = `SELECT * FROM ${this.tableName} WHERE ${whereClause}`;
    
    const result = await this.query(query, Object.values(conditions), client);
    return result.rows[0] || null;
  }

  // Create new record and return it
  async create(data, client = null) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
    
    const query = `
      INSERT INTO ${this.tableName} (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await this.query(query, values, client);
    return result.rows[0];
  }

  // Update record by ID and return updated record
  async update(id, data, client = null) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    
    const setClause = keys.map((key, idx) => `${key} = $${idx + 1}`).join(', ');
    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${keys.length + 1}
      RETURNING *
    `;
    
    const result = await this.query(query, [...values, id], client);
    return result.rows[0];
  }

  // Delete record by ID and return deleted record
  async delete(id, client = null) {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`;
    const result = await this.query(query, [id], client);
    return result.rows[0];
  }

  // Count records matching conditions
  async count(conditions = {}, client = null) {
    let query = `SELECT COUNT(*) FROM ${this.tableName}`;
    const params = [];

    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map((key, idx) => `${key} = $${idx + 1}`)
        .join(' AND ');
      query += ` WHERE ${whereClause}`;
      params.push(...Object.values(conditions));
    }

    const result = await this.query(query, params, client);
    return parseInt(result.rows[0].count);
  }

  // Check if any record exists matching conditions
  async exists(conditions, client = null) {
    const count = await this.count(conditions, client);
    return count > 0;
  }

  // Start database transaction - must call commitTransaction or rollbackTransaction
  async beginTransaction() {
    const client = await this.pool.connect();
    await client.query('BEGIN');
    return client;
  }

  // Commit transaction and release connection
  async commitTransaction(client) {
    await client.query('COMMIT');
    client.release();
  }

  // Rollback transaction on error and release connection
  async rollbackTransaction(client) {
    await client.query('ROLLBACK');
    client.release();
  }
}

export default BaseRepository;
