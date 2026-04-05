import OrganizationRepository from '../repositories/OrganizationRepository.js';
import notificationService from './notificationService.js';
import logger from '../utils/logger.js';

const VALID_NOTIFICATION_ROOTS = new Set([
  '/dashboard',
  '/orders',
  '/shipments',
  '/inventory',
  '/products',
  '/warehouses',
  '/carriers',
  '/exceptions',
  '/returns',
  '/analytics',
  '/sla',
  '/finance',
  '/help',
  '/settings',
  '/team',
  '/partners',
  '/notifications',
  '/super-admin',
]);

function normalizeNotificationLink(link) {
  if (!link) return '/notifications';

  const normalized = String(link).startsWith('/') ? String(link) : `/${String(link)}`;
  if (normalized === '/jobs') return '/notifications';

  const firstSegment = `/${normalized.split('/').filter(Boolean)[0] || ''}`;
  return VALID_NOTIFICATION_ROOTS.has(firstSegment) ? normalized : '/notifications';
}

async function notifyOrganizationUsers({
  organizationId,
  type = 'system',
  title,
  message,
  link = '/notifications',
  metadata = null,
}) {
  if (!organizationId) return;

  const safeLink = normalizeNotificationLink(link);

  try {
    const users = await OrganizationRepository.getUsersByOrganization(organizationId);
    const recipientIds = users.filter((u) => u.is_active).map((u) => u.id);
    if (recipientIds.length === 0) return;

    const outcomes = await Promise.allSettled(
      recipientIds.map((userId) =>
        notificationService.createNotification(userId, type, title, message, safeLink, metadata)
      )
    );

    const failed = outcomes.filter((o) => o.status === 'rejected').length;
    if (failed > 0) {
      logger.warn('Some operational notifications failed', {
        organizationId,
        title,
        recipients: recipientIds.length,
        failed,
      });
    }
  } catch (error) {
    logger.error('Failed to notify organization users', {
      organizationId,
      title,
      error,
    });
  }
}

function queueOrganizationNotification(payload) {
  setImmediate(async () => {
    await notifyOrganizationUsers(payload);
  });
}

export default {
  normalizeNotificationLink,
  notifyOrganizationUsers,
  queueOrganizationNotification,
};
