# ⚠️ CRITICAL PRODUCTION WARNINGS

## 🚨 BEFORE DEPLOYING TO PRODUCTION

### 1. IN-MEMORY SECURITY STATE (CRITICAL)

**Current Implementation:** All security tracking (blocked IPs, rate limits, request tracking) is stored **in local memory**.

**Problems:**
- ❌ Data lost on server restart
- ❌ Doesn't work with multiple server instances (load balancing)
- ❌ Attackers can bypass blocks by restarting the server or hitting different instances

**REQUIRED FIX for Production:**

#### Option A: Redis (Recommended)
```bash
# Install Redis on Ubuntu
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Install Redis client for Node.js
npm install ioredis
```

Update `server/advanced-security.ts` to use Redis:
```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  // For production with password:
  // password: process.env.REDIS_PASSWORD
});

// Replace Map with Redis
async function blockIP(ip: string, durationMinutes: number, reason: string) {
  const expiry = Date.now() + (durationMinutes * 60000);
  await redis.set(`blocked:${ip}`, expiry, 'EX', durationMinutes * 60);
  console.error(`[SECURITY BLOCK] IP ${ip} blocked for ${durationMinutes} minutes. Reason: ${reason}`);
}

async function isIPBlocked(ip: string): Promise<boolean> {
  const blocked = await redis.get(`blocked:${ip}`);
  return blocked !== null;
}
```

#### Option B: Upstash Redis (Serverless - Easy Setup)
```bash
npm install @upstash/redis
```

Sign up at https://upstash.com and get:
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN

Add to `.env`:
```env
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

### 2. CLOUDFLARE IP VALIDATION (FIXED)

**Status:** ✅ Partially fixed in latest version

**Current Implementation:** Basic validation that checks if request is from Cloudflare before trusting headers.

**Production Enhancement Needed:**

Install CIDR validation library:
```bash
npm install ip-range-check
```

Update `server/security.ts`:
```typescript
import ipRangeCheck from 'ip-range-check';

function isCloudflareIP(ip: string): boolean {
  return ipRangeCheck(ip, CLOUDFLARE_IPV4_RANGES);
}
```

**Update Cloudflare ranges monthly:**
```bash
# Get latest ranges
curl https://www.cloudflare.com/ips-v4 -o cloudflare-ips.txt
```

### 3. RATE LIMITING ACROSS INSTANCES

**Current:** express-rate-limit uses in-memory store

**Production Fix:** Use Redis store

```bash
npm install rate-limit-redis
```

```typescript
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export const globalRateLimit = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 100,
  // ... rest of config
});
```

### 4. MONITORING & ALERTING (REQUIRED)

**Must Have in Production:**

#### A. Setup Monitoring
```bash
# Install monitoring tools
npm install @sentry/node  # Error tracking
npm install prom-client   # Metrics
```

Add to your app:
```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'production',
});
```

#### B. Log Management
```bash
# Install better logging
npm install winston

# Setup log rotation
sudo apt install logrotate
```

#### C. Uptime Monitoring
- Use: UptimeRobot, Pingdom, or Better Uptime
- Monitor: https://yourdomain.com/api/health
- Alert: Email/SMS on downtime

### 5. ENVIRONMENT VARIABLES (SECURE)

**Never commit `.env` file to git!**

Add to `.gitignore`:
```
.env
.env.local
.env.production
```

**Production Environment Variables:**
```env
NODE_ENV=production
PORT=3000

# Security Keys
HCAPTCHA_SECRET_KEY=
CLOUDFLARE_TURNSTILE_SECRET=
SECURITY_ADMIN_KEY=

# Redis (REQUIRED)
REDIS_URL=redis://localhost:6379
# OR for Upstash
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Monitoring
SENTRY_DSN=

# Discord
DISCORD_WEBHOOK_URL=
```

### 6. SSL/TLS CONFIGURATION

**Nginx SSL Hardening:**

Edit `/etc/nginx/sites-available/your-site`:
```nginx
# SSL Configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
ssl_prefer_server_ciphers on;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_stapling on;
ssl_stapling_verify on;

# Security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

### 7. DATABASE SECURITY (If Using)

If you add a database:

```bash
# PostgreSQL hardening
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Only allow localhost:
```
local   all   all   peer
host    all   all   127.0.0.1/32   scrypt
```

**Never expose database to internet!**

### 8. BACKUP STRATEGY (REQUIRED)

**Automated Backups:**

```bash
# Create backup script
nano ~/backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/backups

mkdir -p $BACKUP_DIR

# Backup application
tar -czf $BACKUP_DIR/app_$DATE.tar.gz ~/apps/cartel-appeals

# Backup Redis (if using)
redis-cli SAVE
cp /var/lib/redis/dump.rdb $BACKUP_DIR/redis_$DATE.rdb

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.rdb" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
chmod +x ~/backup.sh

# Add to cron (daily at 2 AM)
crontab -e
0 2 * * * /home/azureuser/backup.sh
```

### 9. DDOS MITIGATION LAYERS

**Current Layers:**
1. ✅ Cloudflare (Network layer DDoS)
2. ✅ Nginx rate limiting
3. ✅ Application rate limiting (18 layers)
4. ❌ Redis-backed blocking (IMPLEMENT THIS)

**Additional Protection:**

#### Enable Cloudflare Under Attack Mode API:
```bash
# Install Cloudflare CLI
npm install -g cloudflare-cli

# Set in .env
CLOUDFLARE_API_KEY=your_api_key
CLOUDFLARE_ZONE_ID=your_zone_id
```

Create auto-defense script:
```typescript
// Auto-enable attack mode when under attack
async function enableAttackMode() {
  await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/settings/security_level`, {
    method: 'PATCH',
    headers: {
      'X-Auth-Key': process.env.CLOUDFLARE_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value: 'under_attack' }),
  });
}
```

### 10. COST OPTIMIZATION

**Azure Costs:**
- VM: $30-80/month (B2s or B2ms)
- Bandwidth: ~$0.05/GB outbound
- SSL: Free (Let's Encrypt)

**Cloudflare Costs:**
- Free: Basic DDoS, SSL, CDN
- Pro ($20/mo): Better DDoS, WAF, analytics
- Business ($200/mo): Advanced DDoS, 24/7 support

**Redis Costs:**
- Self-hosted: $0 (on same VM)
- Upstash: $10-50/month (recommended for scale)

## 🔥 DEPLOYMENT CHECKLIST

Before going live:

### Security
- [ ] Redis installed and configured for all rate limiting
- [ ] Cloudflare IP validation with proper CIDR checking
- [ ] All environment variables secured and not in git
- [ ] SSL certificate installed and auto-renewing
- [ ] Firewall rules configured (UFW)
- [ ] Fail2Ban running for SSH protection
- [ ] SSH password auth disabled
- [ ] ModSecurity enabled in Nginx
- [ ] All 18 application security layers tested

### Monitoring
- [ ] Sentry or error tracking configured
- [ ] Uptime monitoring setup (UptimeRobot/Pingdom)
- [ ] Log rotation configured
- [ ] Backup script running (cron)
- [ ] Alerts configured (email/SMS)

### Performance
- [ ] Redis running for state management
- [ ] Nginx caching configured
- [ ] Cloudflare caching enabled
- [ ] PM2 cluster mode enabled (for multi-core)
- [ ] Load testing completed

### Documentation
- [ ] All credentials documented securely
- [ ] Runbook created for incidents
- [ ] Team trained on deployment process
- [ ] Rollback procedure documented

## 🆘 EMERGENCY PROCEDURES

### Under Heavy Attack:
```bash
# 1. Enable Cloudflare attack mode
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/ZONE_ID/settings/security_level" \
  -H "X-Auth-Key: API_KEY" \
  -d '{"value":"under_attack"}'

# 2. Check blocked IPs
curl http://localhost:3000/api/security/blocked-ips

# 3. Monitor logs
pm2 logs cartel-appeals --lines 100
sudo tail -f /var/log/nginx/access.log
```

### Server Down:
```bash
# Check app status
pm2 status

# Restart app
pm2 restart cartel-appeals

# Check Nginx
sudo systemctl status nginx
sudo nginx -t

# Check Redis
redis-cli ping
```

### High CPU/Memory:
```bash
# Identify problem
top
htop

# Restart with zero downtime
pm2 reload cartel-appeals

# Scale up (if needed)
pm2 scale cartel-appeals +2
```

## 📞 SUPPORT CONTACTS

- **Azure Support:** https://portal.azure.com → Support
- **Cloudflare Support:** https://dash.cloudflare.com → Support
- **Security Issues:** Report immediately to security team

---

## ⚠️ FINAL WARNING

**This application uses in-memory security tracking which is NOT production-safe for serious DDoS attacks!**

**MUST DO before production:**
1. ✅ Implement Redis for all security state
2. ✅ Add proper Cloudflare IP validation with CIDR library
3. ✅ Setup monitoring and alerting
4. ✅ Configure automated backups
5. ✅ Load test the application

**Failure to implement these will result in:**
- Security bypasses on server restart
- Failed protection with multiple instances
- Data loss without backups
- Undetected outages without monitoring
