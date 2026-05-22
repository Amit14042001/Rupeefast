/**
 * PM2 Ecosystem Configuration — RupeeFast Production
 *
 * Start with:
 *   NODE_ENV=production pm2 start ecosystem.config.js
 *
 * Or via npm script:
 *   npm run start:production
 *
 * Monitor:
 *   pm2 monit
 *   pm2 logs
 *   pm2 status
 */
module.exports = {
  apps: [{
    name: 'rupeefast',
    script: 'src/server.js',
    cwd: __dirname,

    // ── Clustering ──
    // Use all available CPU cores in cluster mode.
    // Each cluster instance shares port 3000 via PM2's built-in load balancer.
    exec_mode: 'cluster',
    instances: process.env.PM2_INSTANCES || 'max',

    // ── Environment ──
    // Load .env file automatically (dotenv is already called in server.js)
    env: {
      NODE_ENV: 'production',
    },

    // ── Logging ──
    // PM2 captures stdout/stderr from each cluster instance.
    // Logs are rotated — see `pm2 install pm2-logrotate` for production rotation.
    error_file: './logs/rupeefast-error.log',
    out_file: './logs/rupeefast-out.log',
    log_file: './logs/rupeefast-combined.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    time: true,            // Prefix logs with timestamp

    // ── Restart Behavior ──
    max_restarts: 10,           // Max consecutive restarts before stopping
    restart_delay: 1000,        // Wait 1s between restarts
    max_memory_restart: '500M', // Restart if process exceeds 500MB
    min_uptime: '10s',          // Consider process stable after 10s uptime

    // ── Watch (disabled in production) ──
    watch: false,

    // ── Graceful Shutdown ──
    // Our server.js already listens for SIGTERM and SIGINT to close
    // the HTTP server and DB pool gracefully.
    kill_timeout: 12000,        // Wait 12s before force-killing (our handler has 10s timeout)
    listen_timeout: 15000,      // Wait up to 15s for the app to start listening

    // ── Error Handling ──
    // Don't crash the PM2 process if a cluster instance exits
    autorestart: true,
    exp_backoff_restart_delay: 100,  // Exponential backoff for restarts
  }],
};
