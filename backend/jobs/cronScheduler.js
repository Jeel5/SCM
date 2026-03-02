/**
 * Cron Scheduler — BullMQ-backed repeatable jobs.
 *
 * Replaces the old DB-polling approach (checking every 60s) with BullMQ's
 * native repeatable jobs stored in Redis. BullMQ fires jobs at the exact
 * cron time, with no polling overhead.
 *
 * Flow:
 *   start(initialSchedules)  — register all active DB schedules in BullMQ
 *   addSchedule(schedule)    — called by jobsService when a schedule is created
 *   updateSchedule(schedule) — called by jobsService when a schedule is updated
 *   removeSchedule(id)       — called by jobsService when a schedule is deleted
 *
 * When a repeatable job fires, the BullMQ Worker processes it via the cron
 * path (isCron: true) which creates a DB job record for the audit trail.
 */
import { jobQueue } from '../queues/index.js';
import logger from '../utils/logger.js';

/**
 * Build the stable BullMQ job name for a given schedule.
 * Using a deterministic name lets us find and remove it later.
 */
function cronJobName(scheduleId) {
  return `cron:${scheduleId}`;
}

class CronScheduler {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Sync all active DB cron schedules into BullMQ repeatable jobs.
   * Called on server startup.
   *
   * @param {Array} initialSchedules - array of schedule rows from the DB
   */
  async start(initialSchedules = []) {
    if (this.isRunning) {
      logger.warn('CronScheduler is already running');
      return;
    }

    // Remove stale repeatable jobs from BullMQ (schedules deleted while server was down)
    const existing = await jobQueue.getRepeatableJobs();
    const activeIds = new Set(
      initialSchedules.filter((s) => s.is_active).map((s) => cronJobName(s.id))
    );

    for (const repeatJob of existing) {
      if (repeatJob.name.startsWith('cron:') && !activeIds.has(repeatJob.name)) {
        await jobQueue.removeRepeatableByKey(repeatJob.key);
        logger.info(`🗑️  Removed stale repeatable job: ${repeatJob.name}`);
      }
    }

    // Register (or re-register) all active schedules
    const existingNames = new Set(existing.map((j) => j.name));
    let registered = 0;
    for (const schedule of initialSchedules) {
      if (!schedule.is_active) continue;
      if (!existingNames.has(cronJobName(schedule.id))) {
        await this._register(schedule);
        registered++;
      }
    }

    this.isRunning = true;
    logger.info('⏰ CronScheduler started (BullMQ-backed)', {
      total: initialSchedules.filter((s) => s.is_active).length,
      registered,
      engine: 'bullmq',
    });
  }

  /** Register a new cron schedule as a BullMQ repeatable job. */
  async addSchedule(schedule) {
    if (!schedule.is_active) return;
    await this._register(schedule);
    logger.info(`➕ Cron schedule registered: ${schedule.name} (${schedule.cron_expression})`);
  }

  /**
   * Update an existing cron schedule.
   * BullMQ repeatable jobs are immutable — update = remove + re-add.
   */
  async updateSchedule(schedule) {
    // Remove old repeatable (if any)
    await this.removeSchedule(schedule.id);

    // Re-add only if still active
    if (schedule.is_active) {
      await this._register(schedule);
      logger.info(`✏️  Cron schedule updated: ${schedule.name}`);
    }
  }

  /** Remove a cron schedule from BullMQ by its DB id. */
  async removeSchedule(scheduleId) {
    const name = cronJobName(scheduleId);
    const jobs = await jobQueue.getRepeatableJobs();
    const target = jobs.find((j) => j.name === name);
    if (target) {
      await jobQueue.removeRepeatableByKey(target.key);
      logger.info(`🗑️  Cron schedule removed: ${name}`);
    }
  }

  async stop() {
    this.isRunning = false;
    // Repeatable jobs remain registered in Redis and will fire again when
    // the server restarts — no cleanup needed here.
    logger.info('✅ CronScheduler stopped');
  }

  getStatus() {
    return { isRunning: this.isRunning, engine: 'bullmq' };
  }

  // ── Private ─────────────────────────────────────────────────────────────

  async _register(schedule) {
    const payload = typeof schedule.payload === 'string'
      ? JSON.parse(schedule.payload)
      : (schedule.payload || {});

    await jobQueue.add(
      cronJobName(schedule.id),
      {
        isCron: true,
        cronScheduleId: schedule.id,
        jobType: schedule.job_type,
        payload,
      },
      {
        repeat: { pattern: schedule.cron_expression },
        // Note: BullMQ assigns its own jobId when a repeatable job fires — don't set a custom one here
      }
    );
  }
}

// Export singleton — server.js calls start(initialSchedules) on boot
export const cronScheduler = new CronScheduler();
export default cronScheduler;
