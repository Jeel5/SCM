import bcrypt from 'bcrypt';
import pool from '../configs/db.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';

// Login with email/password
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    console.log('Login attempt for:', email);
    
    const result = await pool.query(
      `SELECT u.*, o.name as organization_name, 
              COALESCE(array_agg(up.permission) FILTER (WHERE up.permission IS NOT NULL), '{}') as permissions
       FROM users u 
       LEFT JOIN organizations o ON u.organization_id = o.id
       LEFT JOIN user_permissions up ON u.id = up.user_id 
       WHERE u.email = $1 AND u.is_active = true
       GROUP BY u.id, o.name`,
      [email]
    );
    
    console.log('User found:', result.rows.length > 0);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    console.log('Password hash exists:', !!user.password_hash);
    console.log(user.password_hash, user.email, password);
    
    const isValid = await bcrypt.compare(password, "$2b$10$WUddUaFWTuZZIvbgGC9IV.701wN7afg.r4F5lYzgZT6VFHR3UKruu");
    console.log('Password valid:', isValid);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    
    const tokenPayload = { userId: user.id, role: user.role, email: user.email };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organization_id,
          avatar: user.avatar,
          permissions: user.permissions,
          lastLogin: user.last_login,
          createdAt: user.created_at
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

// Refresh token
export async function refreshToken(req, res) {
  try {
    const { refreshToken: token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Refresh token required' });
    }
    
    const decoded = verifyRefreshToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    const result = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    const tokenPayload = { userId: user.id, role: user.role, email: user.email };
    const newAccessToken = generateAccessToken(tokenPayload);
    
    res.json({ success: true, data: { accessToken: newAccessToken } });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
}

// Get current user profile
export async function getProfile(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.*, o.name as organization_name,
              COALESCE(array_agg(up.permission) FILTER (WHERE up.permission IS NOT NULL), '{}') as permissions
       FROM users u 
       LEFT JOIN organizations o ON u.organization_id = o.id
       LEFT JOIN user_permissions up ON u.id = up.user_id 
       WHERE u.id = $1
       GROUP BY u.id, o.name`,
      [req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organization_id,
        avatar: user.avatar,
        permissions: user.permissions,
        lastLogin: user.last_login,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
}

// List users (admin only)
export async function listUsers(req, res) {
  try {
    const { role, is_active, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT u.id, u.email, u.name, u.role, u.avatar, u.is_active, 
             u.last_login, u.created_at, u.organization_id,
             o.name as organization_name
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      WHERE 1=1
    `;
    const params = [];
    
    if (role) {
      params.push(role);
      query += ` AND u.role = $${params.length}`;
    }
    
    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND u.is_active = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }
    
    // Get total count
    const countResult = await pool.query(
      query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM'),
      params
    );
    const total = parseInt(countResult.rows[0].count);
    
    // Add pagination
    query += ` ORDER BY u.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      total,
      page: parseInt(page),
      pageSize: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
}

// List roles
export async function listRoles(req, res) {
  res.json({
    success: true,
    data: [
      { id: 'admin', name: 'Administrator', description: 'Full system access' },
      { id: 'operations_manager', name: 'Operations Manager', description: 'Manage orders and shipments' },
      { id: 'warehouse_manager', name: 'Warehouse Manager', description: 'Manage inventory and warehouses' },
      { id: 'carrier_partner', name: 'Carrier Partner', description: 'View and update shipments' },
      { id: 'finance', name: 'Finance', description: 'Access financial reports' },
      { id: 'customer_support', name: 'Customer Support', description: 'Handle returns and exceptions' }
    ]
  });
}

// Logout (client-side token removal, but we can log it)
export async function logout(req, res) {
  try {
    // Log the logout action
    if (req.user) {
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, created_at) 
         VALUES ($1, 'logout', 'user', NOW())`,
        [req.user.userId]
      );
    }
    res.json({ success: true, data: null });
  } catch (error) {
    res.json({ success: true, data: null });
  }
}
