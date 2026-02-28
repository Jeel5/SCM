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

import organizationRepo from '../repositories/OrganizationRepository.js';
import SalesChannelRepo from '../repositories/SalesChannelRepository.js';
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
    // 1. Try organization webhook token first
    const org = await organizationRepo.findByWebhookToken(orgToken);

    if (org) {
      req.webhookOrganizationId = org.id;
      req.webhookOrgCode        = org.code;
      req.webhookOrgName        = org.name;
      logger.debug(`Webhook org resolved: ${org.code} (${org.id})`);
      return next();
    }

    // 2. Fall back to sales_channels webhook token
    const channel = await SalesChannelRepo.findByWebhookToken(orgToken);

    if (channel) {
      req.webhookOrganizationId = channel.organization_id;
      req.webhookOrgCode        = channel.code;
      req.webhookOrgName        = channel.name;
      req.webhookChannelId      = channel.id;
      logger.debug(`Webhook channel resolved: ${channel.code} (org ${channel.organization_id})`);
      return next();
    }

    logger.warn(`Webhook: invalid/unknown org token`, {
      path: req.path,
      ip: req.ip,
      tokenPrefix: orgToken.substring(0, 8) + '...'
    });
    return res.status(401).json({
      success: false,
      message: 'Invalid webhook token'
    });
  } catch (error) {
    logger.error('Error resolving webhook org token:', error);
    next(error);
  }
}
