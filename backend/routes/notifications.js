// Notification routes
import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} from '../controllers/notificationController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// All notification routes require authentication
router.get('/notifications', authenticate, getNotifications);
router.get('/notifications/unread-count', authenticate, getUnreadCount);
router.patch('/notifications/read-all', authenticate, markAllAsRead);
router.patch('/notifications/:id/read', authenticate, markAsRead);
router.delete('/notifications', authenticate, deleteAllNotifications);
router.delete('/notifications/:id', authenticate, deleteNotification);

export default router;
