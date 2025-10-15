import Redis from 'ioredis';

let redis: Redis | null = null;

function createRedisClient(): Redis | null {
  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.log('[REDIS] Connecting to Upstash Redis...');
      redis = new Redis(process.env.UPSTASH_REDIS_REST_URL);
    } else if (process.env.REDIS_URL) {
      console.log('[REDIS] Connecting to Redis via REDIS_URL...');
      redis = new Redis(process.env.REDIS_URL);
    } else if (process.env.REDIS_HOST) {
      console.log('[REDIS] Connecting to Redis...');
      redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      });
    } else {
      console.warn('[REDIS] No Redis configuration found. Using in-memory fallback (NOT PRODUCTION SAFE)');
      return null;
    }

    redis.on('error', (err) => {
      console.error('[REDIS] Connection error:', err);
      redis = null;
    });

    redis.on('connect', () => {
      console.log('[REDIS] ✅ Connected successfully');
    });

    return redis;
  } catch (error) {
    console.error('[REDIS] Failed to create client:', error);
    return null;
  }
}

redis = createRedisClient();

export default redis;
