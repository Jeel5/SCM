// Main server entry point - starts the Express application
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler, notFoundHandler } from './errors/index.js';
import { requestLogger, requestId, slowRequestLogger } from './middlewares/requestLogger.js';
import logger from './utils/logger.js';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const API_PREFIX = '/api';

// Import route modules
import usersRoutes from './routes/users.js';
import mdmRoutes from './routes/mdm.js';
import ordersRoutes from './routes/orders.js';
import inventoryRoutes from './routes/inventory.js';
import shipmentsRoutes from './routes/shipments.js';
import slaRoutes from './routes/sla.js';
import returnsRoutes from './routes/returns.js';
import jobsRoutes from './routes/jobs.js';
import financeRoutes from './routes/finance.js';

// Security headers middleware
app.use(helmet());

// CORS configuration - allows frontend to communicate with backend
app.use(
	cors({
		origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
		methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		credentials: true,
	})
);

// Parse JSON and URL-encoded request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request tracking and logging middleware
app.use(requestId);
app.use(requestLogger);
app.use(slowRequestLogger(2000));

// Health check endpoint - returns server status
app.get('/health', (req, res) => {
	res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register all API routes
app.use(API_PREFIX, usersRoutes);
app.use(API_PREFIX, mdmRoutes);
app.use(API_PREFIX, ordersRoutes);
app.use(API_PREFIX, inventoryRoutes);
app.use(API_PREFIX, shipmentsRoutes);
app.use(API_PREFIX, slaRoutes);
app.use(API_PREFIX, returnsRoutes);
app.use(API_PREFIX, jobsRoutes);
app.use(API_PREFIX, financeRoutes);

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// Start server and listen on specified port
app.listen(PORT, () => {
	logger.info(`🚀 Server running on http://localhost:${PORT}`);
	logger.info(`📚 API available at http://localhost:${PORT}${API_PREFIX}`);
	logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
	// ✅ Error handling is in place
	// ✅ Frontend can now make requests to our API!
});
