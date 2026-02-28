// Companies Controller - handles company management for superadmin
import companiesRepo from '../repositories/CompaniesRepository.js';
import { AppError, asyncHandler } from '../errors/index.js';
import { logInfo } from '../utils/logger.js';
import { withTransaction } from '../utils/dbTransaction.js';

// Get all companies (superadmin only)
export const getAllCompanies = asyncHandler(async (req, res) => {
    const rows = await companiesRepo.findAllWithStats();

    logInfo('Companies retrieved', { count: rows.length, user: req.user.userId });

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
});

// Get single company details
export const getCompanyById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const company = await companiesRepo.findByIdWithStats(id);

    if (!company) {
      throw new AppError('Company not found', 404);
    }

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
});

// Create new company
export const createCompany = asyncHandler(async (req, res) => {
    const { name, code, email, phone, website, address } = req.body;

    const newRow = await withTransaction(async (tx) => {
      // Uniqueness check + INSERT inside the same transaction to prevent concurrent duplicates
      const codeExists = await companiesRepo.codeExists(code, tx);
      if (codeExists) {
        throw new AppError('Company code already exists', 400);
      }

      return companiesRepo.createOrganization(
        {
          name, code, email, phone, website,
          street: address.street,
          city: address.city,
          state: address.state,
          country: address.country || 'India',
          postalCode: address.postalCode,
        },
        tx
      );
    });

    logInfo('Company created', { companyId: newRow.id, code, createdBy: req.user.userId });

    res.status(201).json({
      success: true,
      data: newRow,
    });
});

// Update company
export const updateCompany = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, website, address } = req.body;

    const updated = await companiesRepo.updateOrganization(id, {
      name,
      email,
      phone,
      website,
      street: address?.street,
      city: address?.city,
      state: address?.state,
      country: address?.country,
      postalCode: address?.postalCode,
    });

    if (!updated) {
      throw new AppError('Company not found', 404);
    }

    logInfo('Company updated', { companyId: id, updatedBy: req.user.userId });

    res.json({
      success: true,
      data: updated,
    });
});

// Delete company (soft-delete with audit trail — hard delete blocked if data exists)
export const deleteCompany = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const check = await companiesRepo.findForDeletion(id);

    if (!check) {
      throw new AppError('Company not found', 404);
    }

    if (check.is_deleted) {
      throw new AppError('Company is already deleted', 400);
    }

    const deleted = await companiesRepo.softDelete(id, req.user.userId);

    if (!deleted) {
      throw new AppError('Company not found or already deleted', 404);
    }

    logInfo('Company soft-deleted', {
      companyId: id,
      companyName: deleted.name,
      deletedBy: req.user.userId,
      hadUsers: parseInt(check.user_count) > 0,
      hadOrders: parseInt(check.order_count) > 0,
    });

    res.json({
      success: true,
      message: 'Company deleted successfully',
    });
});

// Get company users
export const getCompanyUsers = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const rows = await companiesRepo.findUsersByCompany(id);

    res.json({
      success: true,
      data: rows,
    });
});

// Get global statistics for superadmin dashboard
export const getGlobalStats = asyncHandler(async (req, res) => {
    const stats = await companiesRepo.getGlobalStats();

    res.json({
      success: true,
      data: {
        totalCompanies: parseInt(stats.total_companies),
        activeCompanies: parseInt(stats.active_companies),
        totalUsers: parseInt(stats.total_users),
        totalOrders: parseInt(stats.total_orders),
        activeShipments: parseInt(stats.active_shipments),
        totalRevenue: parseFloat(stats.total_revenue),
        avgSlaCompliance: parseFloat(stats.avg_sla_compliance) || 0,
        systemHealth: 99.2, // This would come from a monitoring service
      },
    });
});
