/**
 * BullMQ Queues
 *
 * All background jobs go through a single queue: 'background_jobs'.
 * This includes both manually-triggered jobs and cron-fired jobs.
 *
 * Priority mapping (BullMQ uses 1=highest, DB uses 1=highest too):
 *   DB priority 1  → BullMQ priority 1  (critical)
 *   DB priority 10 → BullMQ priority 10 (lowest)
 *
 * Cron jobs are enqueued as repeatable jobs with a pattern.
 * Regular jobs are enqueued once with optional delay.
 */
import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import logger from '../utils/logger.js';

export const QUEUE_NAME = 'background_jobs';

// One queue instance shared across the app
export const jobQueue = new Queue(QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: parseInt(process.env.JOB_MAX_RETRIES) || 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 25s, 125s
    },
    removeOnComplete: { count: 2000 },
    removeOnFail: { count: 10000 },
  },
});

jobQueue.on('error', (err) => logger.error('Queue error:', err.message));

/**
 * Enqueue a one-off job that already has a DB record.
 *
 * @param {string} jobType     - e.g. 'sla_monitoring'
 * @param {string} jobId       - UUID of the background_jobs DB row
 * @param {object} payload     - job payload (stored in BullMQ for the worker)
 * @param {object} [opts]      - override BullMQ job options
 */
export async function enqueueJob(jobType, jobId, payload, opts = {}) {
  return jobQueue.add(
    jobType,
    { jobId, jobType, payload },
    {
      priority: opts.priority ?? 5,
      delay: opts.delay ?? 0,
      jobId: `db-${jobId}`, // Deduplicate by DB id (no colon — BullMQ v5 forbids it)
      ...opts,
    }
  );
}

export default jobQueue;
