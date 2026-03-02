// Notification CRUD controller
import { notificationService } from '../services/notificationService.js';
import { asyncHandler } from '../errors/errorHandler.js';

// GET /notifications
export const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { page = 1, limit = 20, isRead, type } = req.query;

  const filters = {};
  if (isRead !== undefined) filters.isRead = isRead === 'true';
  if (type) filters.type = type;

  const result = await notificationService.getUserNotifications(
    userId,
    filters,
    parseInt(page),
    parseInt(limit)
  );

  res.json({
    success: true,
    data: result.notifications,
    pagination: result.pagination,
  });
});

// GET /notifications/unread-count
export const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const count = await notificationService.getUnreadCount(userId);
  res.json({ success: true, data: { unreadCount: count } });
});

// PATCH /notifications/:id/read
export const markAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;
  const notification = await notificationService.markAsRead(id, userId);
  res.json({ success: true, data: notification });
});

// PATCH /notifications/read-all
export const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const count = await notificationService.markAllAsRead(userId);
  res.json({ success: true, data: { marked: count } });
});

// DELETE /notifications/:id
export const deleteNotification = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;
  await notificationService.deleteNotification(id, userId);
  res.json({ success: true, message: 'Notification deleted' });
});

// DELETE /notifications
export const deleteAllNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const count = await notificationService.deleteAllNotifications(userId);
  res.json({ success: true, data: { deleted: count } });
});
