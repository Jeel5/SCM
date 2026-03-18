/**
 * BullMQ queues split by workload to avoid import jobs starving operational traffic.
 */
import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import logger from '../utils/logger.js';

export const QUEUE_NAMES = {
  operations: 'background_jobs',
  imports: 'imports_queue',
  notifications: 'notifications_queue',
};

function createQueue(name) {
  return new Queue(name, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: parseInt(process.env.JOB_MAX_RETRIES, 10) || 3,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5s, 25s, 125s
      },
      removeOnComplete: { count: 2000 },
      removeOnFail: { count: 10000 },
    },
  });
}

export const operationsQueue = createQueue(QUEUE_NAMES.operations);
export const importsQueue = createQueue(QUEUE_NAMES.imports);
export const notificationsQueue = createQueue(QUEUE_NAMES.notifications);

// Backward compatible export used by cronScheduler.
export const jobQueue = operationsQueue;

[operationsQueue, importsQueue, notificationsQueue].forEach((queue) => {
  queue.on('error', (err) => logger.error(`Queue error (${queue.name}): ${err.message}`));
});

function resolveQueueByJobType(jobType) {
  if (jobType?.startsWith('import:')) return importsQueue;
  if (jobType === 'notification_dispatch' || jobType === 'return_pickup_reminder') {
    return notificationsQueue;
  }
  return operationsQueue;
}

export function queueNameForJobType(jobType) {
  return resolveQueueByJobType(jobType).name;
}

/**
 * Enqueue a one-off job that already has a DB record.
 *
 * @param {string} jobType     - e.g. 'sla_monitoring'
 * @param {string} jobId       - UUID of the background_jobs DB row
 * @param {object} payload     - job payload (stored in BullMQ for the worker)
 * @param {object} [opts]      - override BullMQ job options
 */
export async function enqueueJob(jobType, jobId, payload, opts = {}) {
  const queue = resolveQueueByJobType(jobType);
  return queue.add(
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

export const allQueues = {
  operationsQueue,
  importsQueue,
  notificationsQueue,
};

export default operationsQueue;
