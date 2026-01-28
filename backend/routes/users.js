// User and authentication routes
import express from 'express';
import { 
  login, refreshToken, getProfile, listUsers, listRoles, logout,
  updateProfile, changePassword, 
  getNotificationPreferences, updateNotificationPreferences,
  getActiveSessions, revokeSession
} from '../controllers/usersController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize, requireRoles, ROLES } from '../middlewares/rbac.js';
import { validateRequest } from '../validators/index.js';
import { 
  loginUserSchema, 
  updateProfileSchema, 
  changePasswordSchema,
  notificationPreferencesSchema 
} from '../validators/userSchemas.js';

const router = express.Router();

// Public routes - no authentication required
router.post('/auth/login', validateRequest(loginUserSchema), login);
router.post('/auth/refresh', refreshToken);

// Protected routes - require authentication
router.get('/auth/profile', authenticate, getProfile);
router.post('/auth/logout', authenticate, logout);

// Settings routes - user profile management
router.patch('/settings/profile', authenticate, validateRequest(updateProfileSchema), updateProfile);
router.post('/settings/password', authenticate, validateRequest(changePasswordSchema), changePassword);
router.get('/settings/notifications', authenticate, getNotificationPreferences);
router.patch('/settings/notifications', authenticate, validateRequest(notificationPreferencesSchema), updateNotificationPreferences);
router.get('/settings/sessions', authenticate, getActiveSessions);
router.delete('/settings/sessions/:sessionId', authenticate, revokeSession);

// Admin-only routes
router.get('/users', authenticate, requireRoles(ROLES.ADMIN, ROLES.OPERATIONS), listUsers);
router.get('/roles', authenticate, requireRoles(ROLES.ADMIN), listRoles);

export default router;
