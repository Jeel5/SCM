/**
 * BullMQ Worker — processes jobs from the 'background_jobs' queue.
 *
 * Handles two kinds of jobs:
 *
 *   1. Regular jobs (enqueued via jobsService.createJob):
 *      data = { jobId, jobType, payload }
 *      → claim DB row → run handler → mark complete/fail
 *
 *   2. Cron-fired jobs (enqueued by cronScheduler as repeatable):
 *      data = { cronScheduleId, jobType, payload, isCron: true }
 *      → create an ephemeral DB row for audit trail → run handler → mark complete/fail
 *
 * BullMQ handles retries (exponential backoff).
 * After all retries exhausted the 'failed' event fires → DLQ.
 */
import { Worker } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { QUEUE_NAMES } from '../queues/index.js';
import { jobHandlers } from './jobHandlers.js';
import { jobsService } from '../services/jobsService.js';
import jobsRepo from '../repositories/JobsRepository.js';
import logger from '../utils/logger.js';

let workers = [];

/**
 * Process a single BullMQ job.
 * Throws on error so BullMQ can apply exponential-backoff retries.
 */
async function processJob(bullJob) {
  const { jobId, jobType, payload, isCron, cronScheduleId } = bullJob.data;
  let dbJobId = jobId;
  let logId = null;

  // ── Cron path: create a DB record for audit trail ───────────────────────
  if (isCron) {
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : (payload || {});
    const dbJob = await jobsRepo.createJobIdempotent({
      jobType,
      payload: parsed,
      priority: 5,
      // Use BullMQ's own job id as idempotency key so re-queued retries
      // don't create duplicate DB rows.
      idempotencyKey: `bullmq:${bullJob.id}`,
    });
    dbJobId = dbJob.id;
    logger.info(`⏰ Cron job triggered: ${jobType} (schedule ${cronScheduleId}, DB id ${dbJobId})`);
  }

  // ── Claim in DB (race-condition guard) ────────────────────────────────
  const logResult = await jobsService.startJobExecution(dbJobId);
  if (!logResult) {
    logger.info(`⏭️  Job ${dbJobId} already claimed — skipping`);
    return;
  }
  logId = logResult.id;

  // ── Resolve and run handler ────────────────────────────────────────────
  const handler = jobHandlers[jobType];
  if (!handler) {
    const err = new Error(`No handler registered for job type: ${jobType}`);
    await jobsService.failJobExecution(dbJobId, logId, err.message);
    throw err;
  }

  logger.info(`🔄 Processing job ${dbJobId}`, { type: jobType });
  const parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : (payload || {});
  // Inject the DB job id so handlers can emit socket progress events (e.g. import jobs).
  parsedPayload._jobId = dbJobId;

  const result = await handler(parsedPayload);

  await jobsService.completeJobExecution(dbJobId, logId, result);
  logger.info(`✅ Job ${dbJobId} completed`, { type: jobType, duration: result?.duration });

  return result;
}

export const jobWorker = {
  async start() {
    if (workers.length > 0) {
      logger.warn('BullMQ Worker is already running');
      return;
    }

    const configs = [
      {
        queueName: QUEUE_NAMES.operations,
        concurrency: parseInt(process.env.JOB_CONCURRENCY || '5', 10),
      },
      {
        queueName: QUEUE_NAMES.imports,
        concurrency: parseInt(process.env.IMPORT_JOB_CONCURRENCY || '1', 10),
      },
      {
        queueName: QUEUE_NAMES.notifications,
        concurrency: parseInt(process.env.NOTIFICATION_JOB_CONCURRENCY || '4', 10),
      },
    ];

    for (const cfg of configs) {
      const worker = new Worker(cfg.queueName, processJob, {
        connection: createRedisConnection(),
        concurrency: cfg.concurrency,
        stalledInterval: 30_000,
      });

      worker.on('completed', (job) => {
        logger.info(`✅ BullMQ job complete: ${job.data.jobType}`, {
          queue: cfg.queueName,
          bullId: job.id,
          attempts: job.attemptsMade,
        });
      });

      worker.on('failed', async (job, err) => {
        if (!job) return;
        const { jobId: dbId, jobType, isCron } = job.data;
        logger.error(`❌ BullMQ job failed: ${jobType}`, {
          queue: cfg.queueName,
          bullId: job.id,
          dbId,
          attempts: job.attemptsMade,
          error: err.message,
        });

        // Move to DLQ only after final attempt, only for DB-tracked regular jobs
        if (job.attemptsMade >= (job.opts?.attempts ?? 1) && dbId && !isCron) {
          try {
            await jobsService.moveToDeadLetterQueue(dbId, err.message);
            logger.info(`📮 Job ${dbId} moved to dead letter queue`);
          } catch (dlqErr) {
            logger.error(`Failed to move job ${dbId} to DLQ:`, dlqErr.message);
          }
        }
      });

      worker.on('stalled', (jobId) => logger.warn(`⚠️  Job stalled (${cfg.queueName}): ${jobId}`));
      worker.on('error', (err) => logger.error(`Worker error (${cfg.queueName}): ${err.message}`));
      workers.push(worker);
    }

    logger.info('🚀 BullMQ Workers started', {
      queues: configs.map((c) => ({ queue: c.queueName, concurrency: c.concurrency })),
    });
  },

  async stop() {
    if (workers.length > 0) {
      await Promise.all(workers.map((w) => w.close()));
      workers = [];
      logger.info('✅ BullMQ Worker stopped');
    }
  },

  getStatus() {
    return { isRunning: workers.length > 0, engine: 'bullmq', workerCount: workers.length };
  },
};

export default jobWorker;
