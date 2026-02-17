// Companies Controller - handles company management for superadmin
import pool from '../configs/db.js';
import { AppError } from '../errors/index.js';
import { logInfo } from '../utils/logger.js';

// Get all companies (superadmin only)
export async function getAllCompanies(req, res, next) {
  try {
    const query = `
      SELECT 
        o.id,
        o.name,
        o.code,
        o.website,
        o.email,
        o.phone,
        o.address,
        o.city,
        o.state,
        o.country,
        o.postal_code,
        o.created_at,
        o.updated_at,
        COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'admin') as admin_count,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT ord.id) as order_count,
        COALESCE(SUM(ord.total_amount), 0) as total_revenue,
        CASE 
          WHEN COUNT(DISTINCT u.id) > 0 AND MAX(u.last_login) > NOW() - INTERVAL '7 days' THEN 'active'
          WHEN COUNT(DISTINCT u.id) > 0 THEN 'inactive'
          ELSE 'suspended'
        END as status
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id AND u.is_active = true
      LEFT JOIN orders ord ON ord.organization_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;

    const { rows } = await pool.query(query);

    logInfo('Companies retrieved', { count: rows.length, user: req.user.id });

    res.json({
      success: true,
      data: rows.map(row => ({
        id: row.id,
        name: row.name,
        code: row.code,
        website: row.website,
        email: row.email,
        phone: row.phone,
        address: {
          street: row.address,
          city: row.city,
          state: row.state,
          country: row.country,
          postalCode: row.postal_code,
        },
        admins: parseInt(row.admin_count),
        users: parseInt(row.user_count),
        orders: parseInt(row.order_count),
        revenue: parseFloat(row.total_revenue),
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    next(error);
  }
}

// Get single company details
export async function getCompanyById(req, res, next) {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        o.*,
        COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'admin') as admin_count,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT ord.id) as order_count,
        COALESCE(SUM(ord.total_amount), 0) as total_revenue
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id AND u.is_active = true
      LEFT JOIN orders ord ON ord.organization_id = o.id
      WHERE o.id = $1
      GROUP BY o.id
    `;

    const { rows } = await pool.query(query, [id]);

    if (rows.length === 0) {
      throw new AppError('Company not found', 404);
    }

    const company = rows[0];

    res.json({
      success: true,
      data: {
        id: company.id,
        name: company.name,
        code: company.code,
        website: company.website,
        email: company.email,
        phone: company.phone,
        address: {
          street: company.address,
          city: company.city,
          state: company.state,
          country: company.country,
          postalCode: company.postal_code,
        },
        admins: parseInt(company.admin_count),
        users: parseInt(company.user_count),
        orders: parseInt(company.order_count),
        revenue: parseFloat(company.total_revenue),
        createdAt: company.created_at,
        updatedAt: company.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
}

// Create new company
export async function createCompany(req, res, next) {
  try {
    const { name, code, email, phone, website, address } = req.body;

    // Check if company code already exists
    const checkQuery = 'SELECT id FROM organizations WHERE code = $1';
    const { rows: existing } = await pool.query(checkQuery, [code]);

    if (existing.length > 0) {
      throw new AppError('Company code already exists', 400);
    }

    const insertQuery = `
      INSERT INTO organizations (
        name, code, email, phone, website, 
        address, city, state, country, postal_code
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      name,
      code,
      email,
      phone,
      website || null,
      address.street,
      address.city,
      address.state,
      address.country || 'India',
      address.postalCode,
    ];

    const { rows } = await pool.query(insertQuery, values);

    logInfo('Company created', { companyId: rows[0].id, code, createdBy: req.user.id });

    res.status(201).json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
}

// Update company
export async function updateCompany(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, phone, website, address } = req.body;

    const updateQuery = `
      UPDATE organizations
      SET 
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        website = COALESCE($4, website),
        address = COALESCE($5, address),
        city = COALESCE($6, city),
        state = COALESCE($7, state),
        country = COALESCE($8, country),
        postal_code = COALESCE($9, postal_code),
        updated_at = NOW()
      WHERE id = $10
      RETURNING *
    `;

    const values = [
      name,
      email,
      phone,
      website,
      address?.street,
      address?.city,
      address?.state,
      address?.country,
      address?.postalCode,
      id,
    ];

    const { rows } = await pool.query(updateQuery, values);

    if (rows.length === 0) {
      throw new AppError('Company not found', 404);
    }

    logInfo('Company updated', { companyId: id, updatedBy: req.user.id });

    res.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
}

// Delete company (soft delete or restrict if has data)
export async function deleteCompany(req, res, next) {
  try {
    const { id } = req.params;

    // Check if company has users or orders
    const checkQuery = `
      SELECT 
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT o.id) as order_count
      FROM organizations org
      LEFT JOIN users u ON u.organization_id = org.id
      LEFT JOIN orders o ON o.organization_id = org.id
      WHERE org.id = $1
      GROUP BY org.id
    `;

    const { rows: checks } = await pool.query(checkQuery, [id]);

    if (checks.length > 0 && (checks[0].user_count > 0 || checks[0].order_count > 0)) {
      throw new AppError(
        'Cannot delete company with existing users or orders. Please archive instead.',
        400
      );
    }

    const deleteQuery = 'DELETE FROM organizations WHERE id = $1 RETURNING *';
    const { rows } = await pool.query(deleteQuery, [id]);

    if (rows.length === 0) {
      throw new AppError('Company not found', 404);
    }

    logInfo('Company deleted', { companyId: id, deletedBy: req.user.id });

    res.json({
      success: true,
      message: 'Company deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

// Get company users
export async function getCompanyUsers(req, res, next) {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        id, email, name, role, avatar, is_active, 
        last_login, created_at
      FROM users
      WHERE organization_id = $1
      ORDER BY created_at DESC
    `;

    const { rows } = await pool.query(query, [id]);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
}

// Get global statistics for superadmin dashboard
export async function getGlobalStats(req, res, next) {
  try {
    const statsQuery = `
      SELECT
        (SELECT COUNT(*) FROM organizations) as total_companies,
        (SELECT COUNT(*) FROM organizations o 
         WHERE EXISTS (
           SELECT 1 FROM users u 
           WHERE u.organization_id = o.id 
           AND u.last_login > NOW() - INTERVAL '7 days'
         )) as active_companies,
        (SELECT COUNT(*) FROM users WHERE is_active = true) as total_users,
        (SELECT COUNT(*) FROM orders) as total_orders,
        (SELECT COUNT(*) FROM shipments WHERE status NOT IN ('delivered', 'cancelled')) as active_shipments,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders) as total_revenue,
        (SELECT ROUND(AVG(sla_compliance_score), 2) FROM (
          SELECT 
            (COUNT(*) FILTER (WHERE actual_delivery_date <= expected_delivery_date)::FLOAT / 
            NULLIF(COUNT(*), 0) * 100) as sla_compliance_score
          FROM shipments
          WHERE actual_delivery_date IS NOT NULL
          GROUP BY organization_id
        ) as sla_scores) as avg_sla_compliance
    `;

    const { rows } = await pool.query(statsQuery);

    res.json({
      success: true,
      data: {
        totalCompanies: parseInt(rows[0].total_companies),
        activeCompanies: parseInt(rows[0].active_companies),
        totalUsers: parseInt(rows[0].total_users),
        totalOrders: parseInt(rows[0].total_orders),
        activeShipments: parseInt(rows[0].active_shipments),
        totalRevenue: parseFloat(rows[0].total_revenue),
        avgSlaCompliance: parseFloat(rows[0].avg_sla_compliance) || 0,
        systemHealth: 99.2, // This would come from a monitoring service
      },
    });
  } catch (error) {
    next(error);
  }
}
