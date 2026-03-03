/**
 * PM2 Ecosystem Config
 *
 * Dev:        pm2 start ecosystem.config.cjs --env development
 * Production: pm2 start ecosystem.config.cjs --env production
 * Docker:     CMD ["pm2-runtime", "ecosystem.config.cjs", "--env", "production"]
 *
 * Cluster mode forks one worker per CPU core so all cores are used.
 * In Docker/Render/Railway with 1 CPU, instances: 1 is fine.
 * On a 4-core VPS, instances: 'max' = 4 Node processes.
 *
 * Socket.IO + cluster: requires the Redis adapter (see sockets/index.js).
 * Without it, sockets only reach clients connected to the SAME worker.
 */
module.exports = {
  apps: [
    {
      name:        'scm-backend',
      script:      'server.js',
      // 'max' = one worker per CPU core; set to 1 on single-core free-tier hosts
      instances:   process.env.NODE_INSTANCES || 'max',
      exec_mode:   'cluster',
      // Restart if memory exceeds 512 MB
      max_memory_restart: '512M',
      // Auto-restart on crash with exponential back-off
      autorestart: true,
      watch:       false,
      // Graceful reload timeout
      kill_timeout: 5000,
      // Wait before sending traffic to a new worker
      wait_ready:   true,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'development',
        PORT:     3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT:     3001,
      },
      // Structured JSON logs go to these files (Winston handles log content)
      out_file:  './logs/pm2-out.log',
      error_file: './logs/pm2-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
