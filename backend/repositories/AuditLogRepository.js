import BaseRepository from './BaseRepository.js';

class AuditLogRepository extends BaseRepository {
  constructor() {
    super('audit_logs');
  }

  async listLogs({ page = 1, limit = 25, organizationId, userId, action, entityType, from, to }, client = null) {
    const offset = (page - 1) * limit;
    const params = [];
    let p = 1;

    const where = ['1=1'];

    if (organizationId) {
      where.push(`al.organization_id = $${p}`);
      params.push(organizationId);
      p += 1;
    }

    if (userId) {
      where.push(`al.user_id = $${p}`);
      params.push(userId);
      p += 1;
    }

    if (action) {
      where.push(`al.action ILIKE $${p}`);
      params.push(`%${action}%`);
      p += 1;
    }

    if (entityType) {
      where.push(`al.entity_type = $${p}`);
      params.push(entityType);
      p += 1;
    }

    if (from) {
      where.push(`al.created_at >= $${p}`);
      params.push(from);
      p += 1;
    }

    if (to) {
      where.push(`al.created_at <= $${p}`);
      params.push(to);
      p += 1;
    }

    const baseSql = `
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN organizations o ON o.id = al.organization_id
      WHERE ${where.join(' AND ')}
    `;

    const dataSql = `
      SELECT
        al.id,
        al.user_id,
        al.organization_id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.changes,
        al.ip_address,
        al.user_agent,
        al.created_at,
        u.name AS user_name,
        u.email AS user_email,
        o.name AS organization_name
      ${baseSql}
      ORDER BY al.created_at DESC
      LIMIT $${p} OFFSET $${p + 1}
    `;

    const countSql = `SELECT COUNT(*)::int AS total ${baseSql}`;

    const [rowsResult, countResult] = await Promise.all([
      this.query(dataSql, [...params, limit, offset], client),
      this.query(countSql, params, client),
    ]);

    return {
      rows: rowsResult.rows,
      total: countResult.rows[0]?.total || 0,
    };
  }
}

export default new AuditLogRepository();
