// User and authentication routes
import express from 'express';
import { 
  login, refreshToken, getProfile, listUsers, listRoles, logout,
  updateProfile, changePassword, verifyEmailChange,
  getNotificationPreferences, updateNotificationPreferences,
  getActiveSessions, revokeSession,
  createOrgUser, getOrgUser, updateOrgUser, deactivateOrgUser
} from '../controllers/usersController.js';
import { authenticate } from '../middlewares/auth.js';
import { authorize, requireRoles, ROLES } from '../middlewares/rbac.js';
import { injectOrgContext } from '../middlewares/multiTenant.js';
import { validateRequest } from '../validators/index.js';
import { 
  loginUserSchema, 
  updateProfileSchema, 
  changePasswordSchema,
  notificationPreferencesSchema,
  createOrgUserSchema,
  updateOrgUserSchema
} from '../validators/userSchemas.js';

const router = express.Router();

// Public routes - no authentication required
router.post('/auth/login', validateRequest(loginUserSchema), login);
router.post('/auth/refresh', refreshToken);

// Protected routes - require authentication
router.get('/auth/profile', authenticate, injectOrgContext, getProfile);
router.post('/auth/logout', authenticate, logout);

// Settings routes - user profile management
router.patch('/settings/profile', authenticate, injectOrgContext, validateRequest(updateProfileSchema), updateProfile);
router.post('/settings/password', authenticate, validateRequest(changePasswordSchema), changePassword);
// Email change verification — public route so the link in the email works without a session
router.get('/settings/verify-email', verifyEmailChange);
router.get('/settings/notifications', authenticate, getNotificationPreferences);
router.patch('/settings/notifications', authenticate, validateRequest(notificationPreferencesSchema), updateNotificationPreferences);
router.get('/settings/sessions', authenticate, getActiveSessions);
router.delete('/settings/sessions/:sessionId', authenticate, revokeSession);

// Admin-only routes
router.get('/users', authenticate, injectOrgContext, requireRoles(ROLES.ADMIN, ROLES.OPERATIONS), listUsers);
router.get('/roles', authenticate, requireRoles(ROLES.ADMIN), listRoles);

// Org user management (admin only, org-scoped)
router.post('/users', authenticate, injectOrgContext, requireRoles(ROLES.ADMIN), validateRequest(createOrgUserSchema), createOrgUser);
router.get('/users/:id', authenticate, injectOrgContext, requireRoles(ROLES.ADMIN, ROLES.OPERATIONS), getOrgUser);
router.put('/users/:id', authenticate, injectOrgContext, requireRoles(ROLES.ADMIN), validateRequest(updateOrgUserSchema), updateOrgUser);
router.delete('/users/:id', authenticate, injectOrgContext, requireRoles(ROLES.ADMIN), deactivateOrgUser);

export default router;
