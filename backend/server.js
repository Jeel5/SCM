// Main server entry point - starts the Express application
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { errorHandler, notFoundHandler } from './errors/index.js';
import { requestLogger, requestId, slowRequestLogger } from './middlewares/requestLogger.js';
import { globalRateLimit, userRateLimit, authRateLimit } from './middlewares/rateLimiter.js';
import logger from './utils/logger.js';
import { jobWorker } from './jobs/jobWorker.js';
import { cronScheduler } from './jobs/cronScheduler.js';
import { jobsService } from './services/jobsService.js';
import { initSocket } from './sockets/index.js';

// Load environment variables from .env file
dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;
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
import organizationsRoutes from './routes/organizations.js';
import partnersRoutes from './routes/partners.js';
import notificationRoutes from './routes/notifications.js';
import logsRoutes from './routes/logs.js';
import importRoutes from './routes/import.js';
import geoRoutes from './routes/geo.js';
import publicRoutes from './routes/public.js';

// Trust the first proxy hop (Nginx) so IP-based rate limiting sees the real client IP
app.set('trust proxy', 1);

// Security headers middleware
app.use(helmet());

const isDev = process.env.NODE_ENV !== "production";

const allowedOrigins =
	process.env.ALLOWED_ORIGINS
		?.split(",")
		.map(o => o.trim()) || [];

const corsOrigin = isDev ? true : allowedOrigins;

app.use(
	cors({
		origin: (origin, callback) => {
			if (isDev) return callback(null, true);

			if (!origin) return callback(null, true);

			if (allowedOrigins.includes(origin)) {
				return callback(null, true);
			}

			return callback(new Error("Not allowed by CORS"));
		},
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	})
);

// Initialise Socket.IO on the shared HTTP server
initSocket(httpServer, corsOrigin);

// Parse JSON bodies and capture raw body for HMAC webhook signature verification.
// The verify callback stores the raw Buffer as req.rawBody so webhook routes can
// validate HMAC signatures without re-serialising (which would alter key order).
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request tracking and logging middleware
app.use(requestId);
app.use(requestLogger);
app.use(slowRequestLogger(2000));

// Global IP-based rate limiter — 200 req/min per IP before any auth
app.use(globalRateLimit);

// Auth-specific strict rate limiter — 10 attempts / 15 min on login & register
app.use('/api/auth', authRateLimit);

// Per-user rate limiter — 500 req/min applied to all authenticated API routes
app.use(API_PREFIX, userRateLimit);

// Health check endpoint - returns server status
app.get('/health', (req, res) => {
	res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register all API routes
app.use(API_PREFIX, usersRoutes);
app.use(API_PREFIX, assignmentsRoutes); // Must be before mdmRoutes — /carriers/assignments/pending would otherwise be swallowed by mdm's /carriers/:id
app.use(API_PREFIX, mdmRoutes);
app.use(API_PREFIX, ordersRoutes);
app.use(API_PREFIX, inventoryRoutes);
app.use(API_PREFIX, shipmentsRoutes);
app.use(API_PREFIX, slaRoutes);
app.use(API_PREFIX, returnsRoutes);
app.use(API_PREFIX, jobsRoutes);
app.use(API_PREFIX, financeRoutes);
app.use(API_PREFIX, shippingRoutes); // Shipping quote routes
app.use(API_PREFIX, carriersRoutes); // Carrier webhook endpoints
// NOTE: /companies routes have been removed. All superadmin org management is under /organizations.
app.use(`${API_PREFIX}/organizations`, organizationsRoutes); // Organization management (superadmin)
app.use(API_PREFIX, partnersRoutes); // Sales channels & suppliers
app.use(API_PREFIX, notificationRoutes); // In-app notifications
app.use(API_PREFIX, logsRoutes); // Audit and activity logs
app.use(API_PREFIX, importRoutes); // Async CSV import endpoints
app.use(API_PREFIX, geoRoutes); // Public geo lookup proxy for demo portals
app.use(API_PREFIX, publicRoutes); // Public lead capture endpoints
app.use('/api/webhooks', webhooksRoutes); // Public webhook endpoints

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

async function startBackgroundWorkers() {
	// Start background job worker
	try {
		await jobWorker.start();
		logger.info('✅ Job Worker initialized');
	} catch (error) {
		logger.error('Failed to start Job Worker:', error);
	}

	// Start cron scheduler — sync active DB schedules into BullMQ repeatable jobs
	try {
		const initialSchedules = await jobsService.getCronSchedules();
		await cronScheduler.start(initialSchedules);
		logger.info('✅ Cron Scheduler initialized');

		// Ensure baseline operational schedules exist (idempotent by job_type check).
		const activeSchedules = await jobsService.getCronSchedules();
		const existingJobTypes = new Set(activeSchedules.map((s) => s.job_type));
		const baselineSchedules = [
			{ name: 'SLA Monitoring (Hourly)', jobType: 'sla_monitoring', cron: '0 * * * *' },
			{ name: 'Exception Escalation (Hourly)', jobType: 'exception_escalation', cron: '15 * * * *' },
			{ name: 'Carrier Assignment Retry (Every 10m)', jobType: 'carrier_assignment_retry', cron: '*/10 * * * *' },
			{ name: 'Invoice Generation (Monthly)', jobType: 'invoice_generation', cron: '0 2 1 * *' },
		];

		for (const schedule of baselineSchedules) {
			if (!existingJobTypes.has(schedule.jobType)) {
				await jobsService.createCronSchedule(schedule.name, schedule.jobType, schedule.cron, {});
				logger.info('✅ Baseline cron schedule created', { jobType: schedule.jobType, cron: schedule.cron });
			}
		}
	} catch (error) {
		logger.error('Failed to start Cron Scheduler:', error);
	}
}

export async function startServer() {
	return new Promise((resolve) => {
		httpServer.listen(PORT, async () => {
			logger.info(`🚀 Server running on http://localhost:${PORT}`);
			logger.info(`📚 API available at http://localhost:${PORT}${API_PREFIX}`);
			logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
			await startBackgroundWorkers();
			resolve(httpServer);
		});
	});
}

const shouldStartServer = process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true';
if (shouldStartServer) {
	startServer();
}

// Graceful shutdown handler
process.on('SIGTERM', async () => {
	logger.info('SIGTERM received, shutting down gracefully...');
	
	// Stop accepting new requests
	httpServer.close(() => {
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
	
	httpServer.close(() => {
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

export { app, httpServer };
export default app;
