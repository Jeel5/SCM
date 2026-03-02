// Job / cron validation schemas
import Joi from 'joi';

const JOB_TYPES = [
  'send_notification', 'generate_report', 'sync_carrier_rates',
  'process_returns', 'update_shipment_status', 'cleanup_old_jobs',
  'sync_inventory', 'generate_invoice', 'process_payments',
  'send_pickup_reminder', 'escalate_exceptions',
];

const JOB_PRIORITIES = ['low', 'normal', 'high', 'critical'];

// ── Queries ──────────────────────────────────────────────────────────────────

export const listJobsQuerySchema = Joi.object({
  page:      Joi.number().integer().min(1).default(1),
  limit:     Joi.number().integer().min(1).max(100).default(20),
  status:    Joi.string().valid('pending', 'running', 'completed', 'failed', 'retrying', 'cancelled', 'dead_letter').optional(),
  job_type:  Joi.string().max(100).optional(),
  priority:  Joi.string().valid(...JOB_PRIORITIES).optional(),
});

export const listDLQQuerySchema = Joi.object({
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const purgeDLQQuerySchema = Joi.object({
  older_than_days: Joi.number().integer().min(1).max(365).default(30),
});

// ── Mutations ────────────────────────────────────────────────────────────────

export const createJobSchema = Joi.object({
  job_type:      Joi.string().max(100).required(),
  payload:       Joi.object().optional().default({}),
  priority:      Joi.string().valid(...JOB_PRIORITIES).optional().default('normal'),
  scheduled_for: Joi.string().isoDate().optional(), // ISO date string; defaults to NOW() on service side
});

export const createCronScheduleSchema = Joi.object({
  name:            Joi.string().min(2).max(255).required(),
  job_type:        Joi.string().max(100).required(),
  cron_expression: Joi.string().min(5).max(100).required(),
  payload:         Joi.object().optional().default({}),
});

export const updateCronScheduleSchema = Joi.object({
  name:            Joi.string().min(2).max(255).optional(),
  cron_expression: Joi.string().min(5).max(100).optional(),
  payload:         Joi.object().optional(),
  is_active:       Joi.boolean().optional(),
}).min(1); // at least one field required

export const analyticsQuerySchema = Joi.object({
  range: Joi.string().valid('day', 'week', 'month', 'year').default('month'),
});

export const analyticsExportQuerySchema = Joi.object({
  type:  Joi.string().valid('orders', 'shipments', 'returns', 'violations').default('orders'),
  range: Joi.string().valid('day', 'week', 'month', 'year').default('month'),
});
