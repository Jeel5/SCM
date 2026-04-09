import { describe, it, expect, vi, beforeEach } from 'vitest';
import notificationService from '../../services/notificationService.js';
import notificationRepository from '../../repositories/NotificationRepository.js';
import { emitToUser } from '../../sockets/emitter.js';

vi.mock('../../repositories/NotificationRepository.js', () => ({
  default: {
    create: vi.fn(),
    findRecentDuplicate: vi.fn(),
    findByUser: vi.fn(),
    countByUser: vi.fn(),
    countUnread: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

vi.mock('../../sockets/emitter.js', () => ({
  emitToUser: vi.fn(),
}));

describe('notificationService realtime behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createNotification persists and emits notification:new', async () => {
    notificationRepository.findRecentDuplicate.mockResolvedValue(null);
    notificationRepository.create.mockResolvedValue({
      id: 'notif-1',
      type: 'order_update',
      title: 'Order Update',
      message: 'Your order has shipped',
      link: '/orders/ORD-1',
      created_at: '2026-03-18T00:00:00.000Z',
    });

    const result = await notificationService.createNotification(
      'user-1',
      'order_update',
      'Order Update',
      'Your order has shipped',
      '/orders/ORD-1'
    );

    expect(result.id).toBe('notif-1');
    expect(notificationRepository.create).toHaveBeenCalledWith(
      'user-1',
      'order_update',
      'Order Update',
      'Your order has shipped',
      '/orders/ORD-1',
      null
    );
    expect(emitToUser).toHaveBeenCalledWith('user-1', 'notification:new', {
      id: 'notif-1',
      type: 'order_update',
      title: 'Order Update',
      message: 'Your order has shipped',
      link: '/orders/ORD-1',
      created_at: '2026-03-18T00:00:00.000Z',
    });
  });

  it('getUserNotifications returns pagination with unread count', async () => {
    notificationRepository.findByUser.mockResolvedValue([
      {
        id: 'notif-1',
        title: 'N1',
        is_read: false,
      },
    ]);
    notificationRepository.countByUser.mockResolvedValue(12);
    notificationRepository.countUnread.mockResolvedValue(3);

    const result = await notificationService.getUserNotifications(
      'user-1',
      { isRead: false },
      2,
      5
    );

    expect(notificationRepository.findByUser).toHaveBeenCalledWith('user-1', { isRead: false }, 2, 5);
    expect(notificationRepository.countByUser).toHaveBeenCalledWith('user-1', { isRead: false });
    expect(notificationRepository.countUnread).toHaveBeenCalledWith('user-1');
    expect(result.notifications).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 5,
      totalCount: 12,
      totalPages: 3,
      unreadCount: 3,
    });
  });

  it('markAsRead returns row for valid notification/user pair', async () => {
    const marked = { id: 'notif-1', is_read: true };
    notificationRepository.markAsRead.mockResolvedValue(marked);

    const result = await notificationService.markAsRead('notif-1', 'user-1');

    expect(notificationRepository.markAsRead).toHaveBeenCalledWith('notif-1', 'user-1');
    expect(result).toEqual(marked);
  });

  it('markAsRead throws when notification is not found for user', async () => {
    notificationRepository.markAsRead.mockResolvedValue(null);

    await expect(notificationService.markAsRead('notif-missing', 'user-1')).rejects.toThrow('Notification');
  });
});
