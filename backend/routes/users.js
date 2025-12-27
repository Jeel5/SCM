import express from 'express';
import { login, refreshToken, getProfile, listUsers, listRoles, logout } from '../controllers/usersController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = express.Router();

// Public routes
router.post('/auth/login', login);
router.post('/auth/refresh', refreshToken);

// Protected routes
router.get('/auth/profile', authenticate, getProfile);
router.post('/auth/logout', authenticate, logout);
router.get('/users', authenticate, listUsers);
router.get('/roles', authenticate, listRoles);

export default router;
