/**
 * Webhook Organization Context Middleware
 *
 * Resolves :orgToken URL parameter → organization_id and attaches it to req.
 * Used on org-scoped webhook routes:
 *   POST /api/webhooks/:orgToken/orders
 *   POST /api/webhooks/:orgToken/inventory  etc.
 *
 * How it works:
 *   1. Read req.params.orgToken
 *   2. SELECT id FROM organizations WHERE webhook_token = $1 AND is_active = true
 *   3. If found  → req.webhookOrganizationId = <uuid>  + call next()
 *   4. If not    → 401 (token is unknown / wrong / org disabled)
 *
 * This prevents one tenant from injecting data into another tenant's dataset,
 * and prevents unknown callers from flooding the jobs queue.
 */

import pool from '../config/db.js';
import logger from '../utils/logger.js';

export async function resolveWebhookOrg(req, res, next) {
  const { orgToken } = req.params;

  if (!orgToken) {
    return res.status(401).json({
      success: false,
      message: 'Missing organization webhook token'
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, code
       FROM organizations
       WHERE webhook_token = $1
         AND is_active = true
       LIMIT 1`,
      [orgToken]
    );

    if (result.rows.length === 0) {
      logger.warn(`Webhook: invalid/unknown org token`, {
        path: req.path,
        ip: req.ip,
        tokenPrefix: orgToken.substring(0, 8) + '...'
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook token'
      });
    }

    const org = result.rows[0];

    // Attach org info so controller can stamp organization_id on the record
    req.webhookOrganizationId = org.id;
    req.webhookOrgCode        = org.code;
    req.webhookOrgName        = org.name;

    logger.debug(`Webhook org resolved: ${org.code} (${org.id})`);
    next();
  } catch (error) {
    logger.error('Error resolving webhook org token:', error);
    next(error);
  }
}
