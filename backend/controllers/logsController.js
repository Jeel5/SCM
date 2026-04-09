import { asyncHandler } from '../errors/errorHandler.js';
import auditLogRepo from '../repositories/AuditLogRepository.js';

function canSeeOrganizationLogs(role) {
  return role === 'admin' || role === 'superadmin';
}

function resolveScope(req, query) {
  const role = req.user?.role;
  const organizationId = req.orgContext?.organizationId || null;
  const requestedUserId = typeof query.user_id === 'string' ? query.user_id : null;
  const requestedOrgId = typeof query.organization_id === 'string' ? query.organization_id : null;

  if (role === 'superadmin') {
    return {
      organizationId: requestedOrgId || null,
      userId: requestedUserId || null,
    };
  }

  if (canSeeOrganizationLogs(role)) {
    return {
      organizationId,
      userId: requestedUserId || null,
    };
  }

  return {
    organizationId,
    userId: req.user.userId,
  };
}

export const getLogs = asyncHandler(async (req, res) => {
  const query = req.query || {};
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 25, 1), 100);

  const { organizationId, userId } = resolveScope(req, query);

  const result = await auditLogRepo.listLogs({
    page,
    limit,
    organizationId,
    userId,
    action: typeof query.action === 'string' ? query.action.trim() : null,
    entityType: typeof query.entity_type === 'string' ? query.entity_type.trim() : null,
    from: typeof query.from === 'string' ? query.from : null,
    to: typeof query.to === 'string' ? query.to : null,
  });

  const data = result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name || 'Unknown User',
    userEmail: row.user_email || null,
    organizationId: row.organization_id,
    organizationName: row.organization_name || null,
    action: row.action,
    entityType: row.entity_type || null,
    entityId: row.entity_id || null,
    changes: row.changes || null,
    ipAddress: row.ip_address || null,
    userAgent: row.user_agent || null,
    createdAt: row.created_at,
  }));

  res.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
  });
});
