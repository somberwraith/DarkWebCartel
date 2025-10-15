// PM2 Ecosystem Configuration - Enterprise Auto-Restart & Monitoring
module.exports = {
  apps: [{
    name: 'cartel-appeals',
    script: 'npm',
    args: 'start',
    
    // AUTO-RESTART CONFIGURATION
    autorestart: true,              // Auto-restart on crash
    max_restarts: 10,               // Max 10 restarts per minute
    min_uptime: '10s',              // Must run 10s to count as successful start
    restart_delay: 1000,            // Wait 1 second between restarts
    
    // CRASH RECOVERY
    exp_backoff_restart_delay: 100, // Exponential backoff on repeated crashes
    max_memory_restart: '500M',     // Restart if memory exceeds 500MB
    
    // MONITORING
    watch: false,                   // Don't watch files in production
    ignore_watch: ['node_modules', 'logs', '.git'],
    
    // PROCESS MANAGEMENT
    instances: 1,                   // Start with 1 instance (scale to 'max' for cluster mode)
    exec_mode: 'fork',              // Use 'cluster' for multi-core
    
    // LOGGING
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // ENVIRONMENT
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    
    // HEALTH CHECKS
    listen_timeout: 10000,          // 10s to start listening
    kill_timeout: 5000,             // 5s graceful shutdown before force kill
    wait_ready: false,
    
    // ADVANCED RECOVERY
    cron_restart: '0 3 * * *',      // Optional: Auto-restart daily at 3 AM
    
    // PERFORMANCE
    node_args: '--max-old-space-size=512', // Limit Node.js memory to 512MB
  }]
};
