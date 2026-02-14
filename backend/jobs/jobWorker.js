// Job Worker - Processes background jobs from the queue
import { jobsService } from '../services/jobsService.js';
import { jobHandlers } from './jobHandlers.js';
import logger from '../utils/logger.js';

class JobWorker {
  constructor(config = {}) {
    this.isRunning = false;
    this.pollInterval = config.pollInterval || 5000; // Poll every 5 seconds
    this.concurrency = config.concurrency || 5; // Process 5 jobs concurrently
    this.activeJobs = new Set();
    this.pollTimer = null;
    this.stopRequested = false;
  }

  /**
   * Start the job worker
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Job worker is already running');
      return;
    }

    this.isRunning = true;
    this.stopRequested = false;
    logger.info('🚀 Job Worker started', {
      pollInterval: this.pollInterval,
      concurrency: this.concurrency,
    });

    // Start polling for jobs
    this.poll();
  }

  /**
   * Stop the job worker gracefully
   */
  async stop() {
    logger.info('🛑 Job Worker stopping...');
    this.stopRequested = true;
    this.isRunning = false;

    // Clear poll timer
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Wait for active jobs to complete
    if (this.activeJobs.size > 0) {
      logger.info(`Waiting for ${this.activeJobs.size} active jobs to complete...`);
      
      // Wait up to 30 seconds for jobs to complete
      const timeout = 30000;
      const startTime = Date.now();
      
      while (this.activeJobs.size > 0 && Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (this.activeJobs.size > 0) {
        logger.warn(`Forcefully stopping with ${this.activeJobs.size} jobs still active`);
      }
    }

    logger.info('✅ Job Worker stopped');
  }

  /**
   * Poll for pending jobs
   */
  async poll() {
    if (this.stopRequested) {
      return;
    }

    try {
      // Only fetch more jobs if we have capacity
      const availableSlots = this.concurrency - this.activeJobs.size;
      
      if (availableSlots > 0) {
        const pendingJobs = await jobsService.getPendingJobs(availableSlots);
        
        if (pendingJobs.length > 0) {
          logger.info(`📥 Found ${pendingJobs.length} pending jobs`);
          
          // Process each job concurrently
          for (const job of pendingJobs) {
            this.processJob(job).catch(error => {
              logger.error('Job processing error:', error);
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error polling for jobs:', error);
    }

    // Schedule next poll
    this.pollTimer = setTimeout(() => this.poll(), this.pollInterval);
  }

  /**
   * Process a single job
   */
  async processJob(job) {
    const jobId = job.id;
    this.activeJobs.add(jobId);

    let logId = null;

    try {
      logger.info(`🔄 Processing job ${jobId}`, {
        type: job.job_type,
        priority: job.priority,
        retryCount: job.retry_count,
      });

      // Start job execution
      const logResult = await jobsService.startJobExecution(jobId);
      logId = logResult.id; // Extract just the ID from the log object

      // Get the appropriate handler for this job type
      const handler = jobHandlers[job.job_type];
      
      if (!handler) {
        throw new Error(`No handler found for job type: ${job.job_type}`);
      }

      // Parse payload
      const payload = typeof job.payload === 'string' 
        ? JSON.parse(job.payload) 
        : job.payload;

      // Execute the job handler
      const result = await handler(payload, job);

      // Complete job execution
      await jobsService.completeJobExecution(jobId, logId, result);

      logger.info(`✅ Job ${jobId} completed successfully`, {
        type: job.job_type,
        duration: result?.duration || 'unknown',
      });

    } catch (error) {
      logger.error(`❌ Job ${jobId} failed:`, {
        error: error.message,
        stack: error.stack,
        type: job.job_type,
      });

      if (logId) {
        await jobsService.failJobExecution(jobId, logId, error.message);
      }

      // Retry logic
      if (job.retry_count < job.max_retries) {
        logger.info(`🔄 Retrying job ${jobId} (attempt ${job.retry_count + 1}/${job.max_retries})`);
        await jobsService.retryJob(jobId);
      } else {
        logger.error(`💀 Job ${jobId} exceeded max retries, moving to dead letter queue`);
        await this.moveToDeadLetterQueue(job, error.message);
      }
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Move failed job to dead letter queue
   */
  async moveToDeadLetterQueue(job, errorMessage) {
    try {
      await jobsService.moveToDeadLetterQueue(job.id, errorMessage);
      logger.info(`📮 Job ${job.id} moved to dead letter queue`);
    } catch (error) {
      logger.error(`Failed to move job ${job.id} to dead letter queue:`, error);
    }
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: this.activeJobs.size,
      capacity: this.concurrency,
      availableSlots: this.concurrency - this.activeJobs.size,
    };
  }
}

// Export singleton instance
export const jobWorker = new JobWorker({
  pollInterval: parseInt(process.env.JOB_POLL_INTERVAL) || 5000,
  concurrency: parseInt(process.env.JOB_CONCURRENCY) || 5,
});

export default jobWorker;
