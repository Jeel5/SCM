// Main server entry point - starts the Express application
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler, notFoundHandler } from './errors/index.js';
import { requestLogger, requestId, slowRequestLogger } from './middlewares/requestLogger.js';
import logger from './utils/logger.js';
import { jobWorker } from './jobs/jobWorker.js';
import { cronScheduler } from './jobs/cronScheduler.js';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT;
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
import webhooksRoutes from './routes/webhooks.js';
import assignmentsRoutes from './routes/assignments.js';
import shippingRoutes from './routes/shipping.js';
import carriersRoutes from './routes/carriers.js';
import companiesRoutes from './routes/companies.js';

// Security headers middleware
app.use(helmet());

// CORS configuration - allows frontend to communicate with backend
app.use(
	cors({
		origin: function (origin, callback) {
			// Allow requests with no origin (like mobile apps, curl, Postman, or file://)
			if (!origin) return callback(null, true);
			
			const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
				'http://localhost:5173',
				'http://localhost:5500',
				'http://127.0.0.1:5500',
				'http://localhost:3000',
			];
			
			// Allow if origin is in the list OR if it's null (file:// protocol)
			if (allowedOrigins.includes(origin) || origin === 'null') {
				callback(null, true);
			} else {
				callback(null, true); // Allow all origins in development mode
			}
		},
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
app.use(API_PREFIX, assignmentsRoutes); // Carrier assignment routes
app.use(API_PREFIX, shippingRoutes); // Shipping quote routes
app.use(API_PREFIX, carriersRoutes); // Carrier webhook endpoints
app.use(API_PREFIX, companiesRoutes); // Superadmin company management
app.use('/api/webhooks', webhooksRoutes); // Public webhook endpoints

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// Start server and listen on specified port
const server = app.listen(PORT, async () => {
	logger.info(`🚀 Server running on http://localhost:${PORT}`);
	logger.info(`📚 API available at http://localhost:${PORT}${API_PREFIX}`);
	logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
	
	// Start background job worker
	try {
		await jobWorker.start();
		logger.info('✅ Job Worker initialized');
	} catch (error) {
		logger.error('Failed to start Job Worker:', error);
	}
	
	// Start cron scheduler
	try {
		await cronScheduler.start();
		logger.info('✅ Cron Scheduler initialized');
	} catch (error) {
		logger.error('Failed to start Cron Scheduler:', error);
	}
});

// Graceful shutdown handler
process.on('SIGTERM', async () => {
	logger.info('SIGTERM received, shutting down gracefully...');
	
	// Stop accepting new requests
	server.close(() => {
		logger.info('HTTP server closed');
	});
	
	// Stop workers
	await Promise.all([
		jobWorker.stop(),
		cronScheduler.stop()
	]);
	
	// Exit process
	process.exit(0);
});

process.on('SIGINT', async () => {
	logger.info('SIGINT received, shutting down gracefully...');
	
	server.close(() => {
		logger.info('HTTP server closed');
	});
	
	await Promise.all([
		jobWorker.stop(),
		cronScheduler.stop()
	]);
	
	process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
	logger.error('Uncaught Exception:', error);
	process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
	logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
	process.exit(1);
});
