// Base Repository - provides common CRUD operations inherited by all repositories
import pool from '../config/db.js';
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

  // Build organization filter for multi-tenant data isolation
  buildOrgFilter(organizationId, tableAlias = null) {
    // Superadmin (organizationId = null) can see all organizations
    if (organizationId === null || organizationId === undefined) {
      return { clause: '', params: [] };
    }

    const columnName = tableAlias 
      ? `${tableAlias}.organization_id` 
      : 'organization_id';
    
    return {
      clause: `${columnName} = `,
      params: [organizationId]
    };
  }

  // Find all records with optional filtering, sorting, pagination, and organization scoping
  async findAll(conditions = {}, options = {}, client = null) {
    const { 
      limit = 50, 
      offset = 0, 
      orderBy = 'created_at', 
      order = 'DESC',
      organizationId = undefined // For multi-tenant filtering
    } = options;
    
    let query = `SELECT * FROM ${this.tableName}`;
    const params = [];
    let paramCount = 1;

    // Build WHERE conditions array
    const whereClauses = [];

    // Add organization filter if organizationId is provided
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId);
      if (orgFilter.clause) {
        whereClauses.push(`${orgFilter.clause}$${paramCount += 1}`);
        params.push(...orgFilter.params);
      }
    }

    // Add other conditions
    if (Object.keys(conditions).length > 0) {
      Object.keys(conditions).forEach(key => {
        whereClauses.push(`${key} = $${paramCount += 1}`);
        params.push(conditions[key]);
      });
    }

    // Combine WHERE clauses
    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    // Add ORDER BY
    // Whitelist orderBy to prevent SQL injection — only allow column names matching
    // word characters (letters, digits, underscore), optionally table-prefixed.
    const safeOrderBy = /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(orderBy) ? orderBy : 'created_at';
    const safeOrder = order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${safeOrderBy} ${safeOrder}`;

    // Add LIMIT and OFFSET
    query += ` LIMIT $${paramCount += 1} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    return result.rows;
  }

  /**
   * Find a single record by ID with optional organization filtering
   */
  async findById(id, organizationId = undefined, client = null) {
    let query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    const params = [id];

    // Add organization filter if provided
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId);
      if (orgFilter.clause) {
        query += ` AND ${orgFilter.clause}$2`;
        params.push(...orgFilter.params);
      }
    }

    const result = await this.query(query, params, client);
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

  // Count records matching conditions with optional organization filtering
  async count(conditions = {}, organizationId = undefined, client = null) {
    let query = `SELECT COUNT(*) FROM ${this.tableName}`;
    const params = [];
    let paramCount = 1;
    const whereClauses = [];

    // Add organization filter if provided
    if (organizationId !== undefined) {
      const orgFilter = this.buildOrgFilter(organizationId);
      if (orgFilter.clause) {
        whereClauses.push(`${orgFilter.clause}$${paramCount += 1}`);
        params.push(...orgFilter.params);
      }
    }

    // Add other conditions
    if (Object.keys(conditions).length > 0) {
      Object.keys(conditions).forEach(key => {
        whereClauses.push(`${key} = $${paramCount += 1}`);
        params.push(conditions[key]);
      });
    }

    // Combine WHERE clauses
    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    const result = await this.query(query, params, client);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Check if any record matching conditions exists.
   * Optionally scoped to an organization.
   * TASK-R6-001: organizationId param added so superadmin bypass is blocked.
   */
  async exists(conditions, organizationId = undefined, client = null) {
    const count = await this.count(conditions, organizationId, client);
    return count > 0;
  }

  // ─── Legacy transaction helpers removed ─────────────────────────────────────
  // Use withTransaction() from ../utils/dbTransaction.js instead.
  // beginTransaction / commitTransaction / rollbackTransaction are gone (TASK-R6-004).
}

export default BaseRepository;
