# 🚨 REDIS SETUP - **REQUIRED** FOR PRODUCTION

## ⚠️ CRITICAL: Your Security Is NOT Production-Ready Without Redis

**Current Status:** ❌ All security state is in MEMORY (lost on restart)

**What This Means:**
- Blocked IPs are UNBLOCKED on server restart
- Rate limits RESET on server restart  
- Attackers can bypass ALL protections by restarting your server
- **UNSAFE for production deployment**

---

## Why Redis is Required

### Current Problem (In-Memory Storage):
```javascript
// ❌ DANGEROUS - Lost on restart
const blockedIPs = new Map();  
const requestTracking = new Map();

// Attacker restarts server → All blocks cleared!
```

### Solution (Redis Storage):
```javascript
// ✅ SAFE - Persists across restarts
await redis.set('blocked:192.168.1.1', expiry);

// Attacker restarts server → Block still active!
```

---

## Quick Setup Guide

### Option 1: Local Redis (Free)

#### On Ubuntu/Azure VPS:
```bash
# Install Redis
sudo apt update
sudo apt install redis-server -y

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test Redis
redis-cli ping
# Should return: PONG
```

#### On Mac (Development):
```bash
brew install redis
brew services start redis
```

#### On Windows:
Download from: https://github.com/microsoftarchive/redis/releases

### Option 2: Upstash Redis (Recommended for Production)

**Why Upstash?**
- ✅ Serverless (auto-scales)
- ✅ Global replication
- ✅ Free tier (10K commands/day)
- ✅ No server management

**Setup:**
1. Go to https://upstash.com
2. Create account (free)
3. Create Redis database
4. Copy connection details

Add to `.env`:
```env
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

---

## Implementation Steps

### Step 1: Install Redis Client

**Already installed!** We included `ioredis` in your dependencies.

### Step 2: Create Redis Client

Create file: `server/redis-client.ts`

```typescript
import Redis from 'ioredis';

// Use Upstash REST API or local Redis
const redis = process.env.UPSTASH_REDIS_REST_URL 
  ? new Redis(process.env.UPSTASH_REDIS_REST_URL)
  : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });

redis.on('error', (err) => {
  console.error('[REDIS] Connection error:', err);
});

redis.on('connect', () => {
  console.log('[REDIS] Connected successfully');
});

export default redis;
```

### Step 3: Update Advanced Security

**File:** `server/advanced-security.ts`

Replace Map-based storage with Redis:

```typescript
import redis from './redis-client';

// OLD (In-Memory - UNSAFE):
const blockedIPs = new Map<string, number>();

// NEW (Redis - SAFE):
export async function blockIP(ip: string, durationMinutes: number, reason: string) {
  const expiry = Date.now() + (durationMinutes * 60000);
  
  // Store in Redis with TTL
  await redis.set(
    `blocked:${ip}`, 
    expiry.toString(), 
    'EX', 
    durationMinutes * 60
  );
  
  console.error(`[SECURITY BLOCK] IP ${ip} blocked for ${durationMinutes} minutes. Reason: ${reason}`);
}

export async function isIPBlocked(ip: string): Promise<boolean> {
  const blocked = await redis.get(`blocked:${ip}`);
  return blocked !== null;
}

// Update middleware to use async version:
export async function ipBlockingMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const isBlocked = await isIPBlocked(ip);
  
  if (isBlocked) {
    const expiry = await redis.get(`blocked:${ip}`);
    const remainingMinutes = expiry ? Math.ceil((parseInt(expiry) - Date.now()) / 60000) : 0;
    
    console.warn(`[SECURITY] Blocked IP attempted access: ${ip} (${remainingMinutes} min remaining)`);
    return res.status(403).json({ 
      error: "Access forbidden. Your IP has been temporarily blocked due to suspicious activity.",
      retryAfter: remainingMinutes 
    });
  }
  
  next();
}
```

### Step 4: Update Rate Limiters

**File:** `server/security.ts`

```bash
npm install rate-limit-redis
```

```typescript
import RedisStore from 'rate-limit-redis';
import redis from './redis-client';

export const globalRateLimit = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:global:',
  }),
  windowMs: 15 * 60 * 1000,
  max: 100,
  // ... rest of config
});

export const appealsRateLimit = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:appeals:',
  }),
  windowMs: 60 * 60 * 1000,
  max: 3,
  // ... rest of config
});
```

---

## Environment Variables

Add to `.env`:

### Local Redis:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Leave empty if no password
```

### Upstash Redis (Recommended):
```env
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

---

## Testing Redis Setup

### Test Connection:
```bash
# If using local Redis
redis-cli ping
# Returns: PONG

# If using Upstash
curl -X POST https://your-instance.upstash.io/get/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test from Application:
```javascript
// Add to server/index.ts temporarily
import redis from './redis-client';

redis.set('test', 'Hello Redis!', 'EX', 10);
redis.get('test').then(val => console.log('Redis test:', val));
```

---

## Cost Comparison

| Option | Cost | Pros | Cons |
|--------|------|------|------|
| **Local Redis** | Free | No external dependency | Single point of failure |
| **Upstash Free** | $0 (10K req/day) | Serverless, reliable | Limited free tier |
| **Upstash Pro** | $10-50/mo | Global, scalable | Monthly cost |
| **Redis Cloud** | $5-100/mo | Managed, enterprise | More expensive |

**Recommendation:** Start with Upstash Free tier, upgrade if needed.

---

## Production Checklist

Before deploying:

- [ ] Redis installed and running
- [ ] Connection tested (`redis.ping()` succeeds)
- [ ] Environment variables set
- [ ] Rate limiters using RedisStore
- [ ] IP blocking using Redis
- [ ] Request tracking using Redis
- [ ] Server restart test (blocks persist ✅)

---

## Migration Script

When ready to migrate from in-memory to Redis:

```bash
# server/migrate-to-redis.ts
import redis from './redis-client';

async function migrate() {
  // Test connection
  const pong = await redis.ping();
  if (pong !== 'PONG') {
    throw new Error('Redis not connected');
  }
  
  console.log('✅ Redis connected');
  console.log('✅ Ready to migrate security state');
  
  // No existing data to migrate since in-memory
  console.log('⚠️  Note: All previous blocks/limits were in memory (lost)');
  console.log('✅ Starting fresh with Redis persistence');
}

migrate().then(() => process.exit(0)).catch(console.error);
```

Run:
```bash
npx tsx server/migrate-to-redis.ts
```

---

## Troubleshooting

### Redis Connection Fails:
```bash
# Check if Redis is running
sudo systemctl status redis-server

# Check Redis logs
sudo tail -f /var/log/redis/redis-server.log

# Test connection manually
redis-cli ping
```

### Upstash Connection Fails:
- Verify `UPSTASH_REDIS_REST_URL` is correct
- Verify `UPSTASH_REDIS_REST_TOKEN` is valid
- Check Upstash dashboard for connection limits

### Performance Issues:
```bash
# Monitor Redis performance
redis-cli --latency
redis-cli --stat

# Check memory usage
redis-cli info memory
```

---

## Security Benefits After Redis

### Before (In-Memory):
- ❌ Blocks lost on restart
- ❌ Can't scale to multiple servers
- ❌ Attackers can clear state

### After (Redis):
- ✅ Blocks survive restarts
- ✅ Shared across all server instances
- ✅ Persistent protection
- ✅ Can handle millions of requests
- ✅ Production-ready scaling

---

## Final Warning

**DO NOT deploy to production without Redis!**

Your security is currently:
- **3/10** - Unsafe (without Redis)
- **9/10** - Enterprise-grade (with Redis + Cloudflare)

**Next Steps:**
1. Set up Redis (local or Upstash)
2. Test connection
3. Update code to use Redis
4. Test IP blocking persists across restart
5. Deploy with confidence

---

**Questions?** Check the logs:
```bash
pm2 logs cartel-appeals | grep -E "REDIS|SECURITY"
```
