// User Repository - handles user authentication and management queries
import BaseRepository from './BaseRepository.js';

class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  // Find user by username
  async findByUsername(username, client = null) {
    const query = `SELECT * FROM users WHERE username = $1`;
    const result = await this.query(query, [username], client);
    return result.rows[0] || null;
  }

  // Find user by email address
  async findByEmail(email, client = null) {
    const query = `SELECT * FROM users WHERE email = $1`;
    const result = await this.query(query, [email], client);
    return result.rows[0] || null;
  }

  // Get users with pagination and filters (role, active status, search)
  async findUsers({ page = 1, limit = 20, role = null, is_active = null, search = null }, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let paramCount = 1;
    
    let query = `
      SELECT 
        id, username, email, full_name, role, department, 
        phone, is_active, last_login, created_at, updated_at,
        COUNT(*) OVER() as total_count
      FROM users
      WHERE 1=1
    `;

    if (role) {
      query += ` AND role = $${paramCount++}`;
      params.push(role);
    }

    if (is_active !== null) {
      query += ` AND is_active = $${paramCount++}`;
      params.push(is_active);
    }

    if (search) {
      query += ` AND (
        username ILIKE $${paramCount} OR
        email ILIKE $${paramCount} OR
        full_name ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC`;
    query += ` LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await this.query(query, params, client);
    
    return {
      users: result.rows,
      totalCount: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0
    };
  }

  /**
   * Update last login time
   */
  async updateLastLogin(userId, client = null) {
    const query = `
      UPDATE users
      SET last_login = NOW()
      WHERE id = $1
      RETURNING id, username, email, full_name, role, last_login
    `;
    const result = await this.query(query, [userId], client);
    return result.rows[0];
  }

  /**
   * Update password
   */
  async updatePassword(userId, hashedPassword, client = null) {
    const query = `
      UPDATE users
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, username, email
    `;
    const result = await this.query(query, [hashedPassword, userId], client);
    return result.rows[0];
  }

  /**
   * Deactivate user
   */
  async deactivate(userId, client = null) {
    const query = `
      UPDATE users
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING id, username, email, is_active
    `;
    const result = await this.query(query, [userId], client);
    return result.rows[0];
  }

  /**
   * Activate user
   */
  async activate(userId, client = null) {
    const query = `
      UPDATE users
      SET is_active = true, updated_at = NOW()
      WHERE id = $1
      RETURNING id, username, email, is_active
    `;
    const result = await this.query(query, [userId], client);
    return result.rows[0];
  }

  /**
   * Get user statistics
   */
  async getUserStats(client = null) {
    const query = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE is_active = true) as active_users,
        COUNT(*) FILTER (WHERE is_active = false) as inactive_users,
        COUNT(*) FILTER (WHERE role = 'admin') as admin_count,
        COUNT(*) FILTER (WHERE role = 'operations') as operations_count,
        COUNT(*) FILTER (WHERE role = 'warehouse') as warehouse_count,
        COUNT(*) FILTER (WHERE role = 'carrier') as carrier_count,
        COUNT(*) FILTER (WHERE role = 'finance') as finance_count,
        COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '7 days') as recent_active_users
      FROM users
    `;
    const result = await this.query(query, [], client);
    return result.rows[0];
  }

  /**
   * Find users by role
   */
  async findByRole(role, client = null) {
    const query = `
      SELECT id, username, email, full_name, role, department, is_active
      FROM users 
      WHERE role = $1 AND is_active = true
      ORDER BY full_name
    `;
    const result = await this.query(query, [role], client);
    return result.rows;
  }

  /**
   * Update user role
   */
  async updateRole(userId, role, client = null) {
    const query = `
      UPDATE users
      SET role = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, username, email, full_name, role
    `;
    const result = await this.query(query, [role, userId], client);
    return result.rows[0];
  }

  /**
   * Get role distribution
   */
  async getRoleDistribution(client = null) {
    const query = `
      SELECT 
        role,
        COUNT(*) as user_count,
        COUNT(*) FILTER (WHERE is_active = true) as active_count
      FROM users
      GROUP BY role
      ORDER BY user_count DESC
    `;
    const result = await this.query(query, [], client);
    return result.rows;
  }

  /**
   * Check if user has specific role
   */
  async hasRole(userId, role, client = null) {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM users 
        WHERE id = $1 AND role = $2 AND is_active = true
      ) as has_role
    `;
    const result = await this.query(query, [userId, role], client);
    return result.rows[0].has_role;
  }
}

export default new UserRepository();
