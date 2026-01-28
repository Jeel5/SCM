// Cron Scheduler - Manages scheduled recurring jobs
import { jobsService } from '../services/jobsService.js';
import parser from 'cron-parser';
import logger from '../utils/logger.js';

class CronScheduler {
  constructor(config = {}) {
    this.isRunning = false;
    this.checkInterval = config.checkInterval || 60000; // Check every minute
    this.timer = null;
    this.stopRequested = false;
  }

  /**
   * Start the cron scheduler
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Cron scheduler is already running');
      return;
    }

    this.isRunning = true;
    this.stopRequested = false;
    logger.info('⏰ Cron Scheduler started', {
      checkInterval: this.checkInterval,
    });

    // Start checking for due schedules
    this.check();
  }

  /**
   * Stop the cron scheduler
   */
  async stop() {
    logger.info('🛑 Cron Scheduler stopping...');
    this.stopRequested = true;
    this.isRunning = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    logger.info('✅ Cron Scheduler stopped');
  }

  /**
   * Check for due cron schedules
   */
  async check() {
    if (this.stopRequested) {
      return;
    }

    try {
      const dueSchedules = await jobsService.getDueCronSchedules();
      
      if (dueSchedules.length > 0) {
        logger.info(`⏰ Found ${dueSchedules.length} due schedules`);
        
        for (const schedule of dueSchedules) {
          await this.executeSchedule(schedule);
        }
      }
    } catch (error) {
      logger.error('Error checking cron schedules:', error);
    }

    // Schedule next check
    this.timer = setTimeout(() => this.check(), this.checkInterval);
  }

  /**
   * Execute a scheduled job
   */
  async executeSchedule(schedule) {
    try {
      logger.info(`🔄 Executing scheduled job: ${schedule.name}`, {
        type: schedule.job_type,
        cronExpression: schedule.cron_expression,
      });

      // Parse payload
      const payload = typeof schedule.payload === 'string' 
        ? JSON.parse(schedule.payload) 
        : schedule.payload;

      // Create a background job
      await jobsService.createJob(
        schedule.job_type,
        payload,
        5, // Default priority
        new Date(), // Execute immediately
        null // System job
      );

      // Update last run time and calculate next run
      await jobsService.updateCronLastRun(schedule.id);

      logger.info(`✅ Scheduled job created: ${schedule.name}`);

    } catch (error) {
      logger.error(`Failed to execute schedule ${schedule.name}:`, error);
      
      // Increment run count even on failure
      try {
        await jobsService.updateCronLastRun(schedule.id);
      } catch (updateError) {
        logger.error('Failed to update cron last run:', updateError);
      }
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
    };
  }

  /**
   * Validate cron expression
   */
  static validateCronExpression(expression) {
    try {
      parser.parseExpression(expression);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get next run times for a cron expression
   */
  static getNextRuns(expression, count = 5) {
    try {
      const interval = parser.parseExpression(expression);
      const runs = [];
      
      for (let i = 0; i < count; i++) {
        runs.push(interval.next().toDate());
      }
      
      return runs;
    } catch (error) {
      throw new Error(`Invalid cron expression: ${error.message}`);
    }
  }
}

// Export singleton instance
export const cronScheduler = new CronScheduler({
  checkInterval: parseInt(process.env.CRON_CHECK_INTERVAL) || 60000,
});

export default cronScheduler;
