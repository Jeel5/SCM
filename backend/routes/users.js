import express from 'express';
import { listUsers, listRoles } from '../controllers/usersController.js';

const router = express.Router();

router.get('/users', listUsers);
router.get('/roles', listRoles);

export default router;
