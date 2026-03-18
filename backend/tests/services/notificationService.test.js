import { describe, it, expect, vi, beforeEach } from 'vitest';
import notificationService from '../../services/notificationService.js';
import notificationRepository from '../../repositories/NotificationRepository.js';
import { emitToUser } from '../../sockets/emitter.js';

vi.mock('../../repositories/NotificationRepository.js', () => ({
  default: {
    create: vi.fn(),
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
});
