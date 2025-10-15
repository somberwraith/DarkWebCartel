import type { Request, Response, NextFunction } from "express";
import redis from "./redis-client";
import { getClientIp } from "./security";

const IN_MEMORY_BLOCKED_IPS = new Map<string, number>();
const IN_MEMORY_REQUEST_TRACKING = new Map<string, { count: number; firstRequest: number; violations: number; fingerprint?: string }>();
const IN_MEMORY_PATTERNS = new Map<string, number>();

export function generateRequestFingerprint(req: Request): string {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
    req.headers['accept'] || '',
  ];
  return Buffer.from(components.join('|')).toString('base64').substring(0, 32);
}

async function blockIPRedis(ip: string, durationMinutes: number): Promise<void> {
  const expiry = Date.now() + (durationMinutes * 60000);
  await redis!.setex(`blocked:${ip}`, durationMinutes * 60, expiry.toString());
}

function blockIPMemory(ip: string, durationMinutes: number): void {
  const expiry = Date.now() + (durationMinutes * 60000);
  IN_MEMORY_BLOCKED_IPS.set(ip, expiry);
  console.warn('[SECURITY] Using in-memory IP blocking - blocks will be lost on restart! Use Redis for production.');
}

export async function blockIP(ip: string, durationMinutes: number = 60, reason: string = "Suspicious activity"): Promise<void> {
  console.error(`[SECURITY BLOCK] IP ${ip} blocked for ${durationMinutes} minutes. Reason: ${reason}`);
  
  if (redis) {
    try {
      await blockIPRedis(ip, durationMinutes);
    } catch (error) {
      console.error('[REDIS ERROR] Failed to block IP, falling back to memory:', error);
      blockIPMemory(ip, durationMinutes);
    }
  } else {
    blockIPMemory(ip, durationMinutes);
  }
}

async function isIPBlockedRedis(ip: string): Promise<boolean> {
  try {
    const blocked = await redis!.get(`blocked:${ip}`);
    return blocked !== null;
  } catch (error) {
    console.error('[REDIS ERROR] Failed to check block status:', error);
    return IN_MEMORY_BLOCKED_IPS.has(ip);
  }
}

function isIPBlockedMemory(ip: string): boolean {
  const expiry = IN_MEMORY_BLOCKED_IPS.get(ip);
  if (!expiry) return false;
  
  if (Date.now() > expiry) {
    IN_MEMORY_BLOCKED_IPS.delete(ip);
    return false;
  }
  return true;
}

async function isIPBlocked(ip: string): Promise<boolean> {
  if (redis) {
    return await isIPBlockedRedis(ip);
  }
  return isIPBlockedMemory(ip);
}

export async function ipBlockingMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = getClientIp(req);
  const blocked = await isIPBlocked(ip);
  
  if (blocked) {
    let remainingMinutes = 0;
    
    if (redis) {
      try {
        const expiry = await redis.get(`blocked:${ip}`);
        remainingMinutes = expiry ? Math.ceil((parseInt(expiry) - Date.now()) / 60000) : 0;
      } catch (error) {
        console.error('[REDIS ERROR]:', error);
      }
    } else {
      const expiry = IN_MEMORY_BLOCKED_IPS.get(ip);
      remainingMinutes = expiry ? Math.ceil((expiry - Date.now()) / 60000) : 0;
    }
    
    console.warn(`[SECURITY] Blocked IP attempted access: ${ip} (${remainingMinutes} min remaining)`);
    res.status(403).json({ 
      error: "Access forbidden. Your IP has been temporarily blocked due to suspicious activity.",
      retryAfter: remainingMinutes 
    });
    return;
  }
  
  next();
}

export async function unblockIP(ip: string): Promise<boolean> {
  if (redis) {
    try {
      const result = await redis.del(`blocked:${ip}`);
      if (result > 0) {
        console.log(`[SECURITY] Manually unblocked IP: ${ip}`);
        return true;
      }
    } catch (error) {
      console.error('[REDIS ERROR]:', error);
    }
  }
  
  if (IN_MEMORY_BLOCKED_IPS.delete(ip)) {
    console.log(`[SECURITY] Manually unblocked IP: ${ip}`);
    return true;
  }
  
  return false;
}

export function getBlockedIPs(): Array<{ ip: string; expiresAt: number; reason: string }> {
  const result: Array<{ ip: string; expiresAt: number; reason: string }> = [];
  
  if (!redis) {
    for (const [ip, expiry] of IN_MEMORY_BLOCKED_IPS.entries()) {
      if (expiry > Date.now()) {
        result.push({ ip, expiresAt: expiry, reason: 'Security violation' });
      }
    }
  }
  
  return result;
}

export function setupHoneypot(app: any): void {
  const honeypotPaths = [
    '/wp-admin', '/wp-login.php', '/wp-config.php', '/xmlrpc.php',
    '/admin', '/administrator', '/admin.php',
    '/phpmyadmin', '/.env', '/.env.production', '/.git/config',
    '/config.php', '/configuration.php',
    '/api/swagger', '/swagger', '/swagger.json', '/swagger.yaml',
    '/swagger/v1/swagger.json', '/swagger/v2/swagger.json',
    '/api-docs', '/api/docs', '/docs', '/graphql', '/api/graphql',
    '/v1/api-docs', '/v2/api-docs', '/openapi.json', '/api.json',
    '/backup', '/backup.sql', '/backup.zip', '/database.sql',
    '/.git', '/.svn', '/.htaccess', '/web.config',
    '/server-status', '/server-info',
  ];
  
  honeypotPaths.forEach(path => {
    app.all(path, async (req: Request, res: Response) => {
      const ip = getClientIp(req);
      console.error(`[HONEYPOT] Malicious access attempt to ${path} from IP: ${ip}`);
      await blockIP(ip, 1440, `Honeypot triggered: ${path}`);
      res.status(404).send('Not Found');
    });
  });
}

export async function connectionFloodDetection(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.path.startsWith('/api')) {
    return next();
  }
  
  const ip = getClientIp(req);
  const now = Date.now();
  
  let tracker = IN_MEMORY_REQUEST_TRACKING.get(ip) || {
    count: 0,
    firstRequest: now,
    violations: 0
  };
  
  if (now - tracker.firstRequest > 10000) {
    tracker.count = 0;
    tracker.firstRequest = now;
    tracker.violations = 0;
  }
  
  tracker.count++;
  
  if (tracker.count > 30) {
    tracker.violations++;
    const blockDuration = Math.min(tracker.violations * 30, 1440);
    await blockIP(ip, blockDuration, `Connection flood: ${tracker.count} requests in 10 seconds`);
    return res.status(429).json({ error: "Request flood detected. IP blocked." });
  }
  
  if (tracker.count > 20) {
    console.warn(`[SECURITY] Potential flood from IP: ${ip} (${tracker.count} requests in 10s)`);
  }
  
  IN_MEMORY_REQUEST_TRACKING.set(ip, tracker);
  next();
}

export async function fingerprintAnomalyDetection(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.path.startsWith('/api')) {
    return next();
  }
  
  const ip = getClientIp(req);
  const fingerprint = generateRequestFingerprint(req);
  const tracker = IN_MEMORY_REQUEST_TRACKING.get(ip);
  
  if (tracker) {
    if (tracker.fingerprint && tracker.fingerprint !== fingerprint) {
      console.warn(`[SECURITY] Fingerprint change detected for IP: ${ip}`);
      tracker.violations = (tracker.violations || 0) + 1;
      
      if (tracker.violations > 3) {
        await blockIP(ip, 120, "Multiple fingerprint changes detected (bot behavior)");
        return res.status(403).json({ error: "Suspicious activity detected" });
      }
    }
    tracker.fingerprint = fingerprint;
    IN_MEMORY_REQUEST_TRACKING.set(ip, tracker);
  }
  
  next();
}

export async function payloadBombProtection(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > 10240) {
      const ip = getClientIp(req);
      console.warn(`[SECURITY] Large payload detected from IP: ${ip} (${contentLength} bytes)`);
      await blockIP(ip, 30, "Payload bomb attempt");
      return res.status(413).json({ error: "Payload too large" });
    }
    
    if (req.body && typeof req.body === 'object') {
      const depth = getObjectDepth(req.body);
      if (depth > 10) {
        const ip = getClientIp(req);
        console.error(`[SECURITY] Deeply nested payload from IP: ${ip} (depth: ${depth})`);
        await blockIP(ip, 60, "Deeply nested payload (potential attack)");
        return res.status(400).json({ error: "Invalid request structure" });
      }
    }
  }
  
  next();
}

function getObjectDepth(obj: any, depth = 0): number {
  if (typeof obj !== 'object' || obj === null || depth > 20) {
    return depth;
  }
  const depths = Object.values(obj).map(value => getObjectDepth(value, depth + 1));
  return depths.length > 0 ? Math.max(...depths) : depth;
}

export async function httpMethodValidation(req: Request, res: Response, next: NextFunction): Promise<void> {
  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  
  if (!allowedMethods.includes(req.method)) {
    const ip = getClientIp(req);
    console.warn(`[SECURITY] Invalid HTTP method ${req.method} from IP: ${ip}`);
    await blockIP(ip, 15, `Invalid HTTP method: ${req.method}`);
    return res.status(405).json({ error: "Method not allowed" });
  }
  
  next();
}

export async function pathTraversalDetection(req: Request, res: Response, next: NextFunction): Promise<void> {
  const path = req.path.toLowerCase();
  const traversalPatterns = ['../', '..\\', '%2e%2e', '%252e', '%c0%ae', '%c1%9c'];
  
  if (traversalPatterns.some(pattern => path.includes(pattern))) {
    const ip = getClientIp(req);
    console.error(`[SECURITY ALERT] Path traversal attempt from IP: ${ip}, Path: ${req.path}`);
    await blockIP(ip, 180, "Path traversal attack attempt");
    return res.status(400).json({ error: "Invalid request path" });
  }
  
  next();
}

export async function rapidRepeatDetection(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.path.startsWith('/api')) {
    return next();
  }
  
  const ip = getClientIp(req);
  const requestSignature = `${req.method}:${req.path}:${JSON.stringify(req.body || {})}`;
  const key = `${ip}:${requestSignature}`;
  
  const lastRequest = IN_MEMORY_PATTERNS.get(key) || 0;
  const now = Date.now();
  
  if (now - lastRequest < 1000) {
    console.warn(`[SECURITY] Rapid repeat request from IP: ${ip}`);
    const tracker = IN_MEMORY_REQUEST_TRACKING.get(ip) || { count: 0, firstRequest: now, violations: 0 };
    tracker.violations = (tracker.violations || 0) + 1;
    
    if (tracker.violations > 5) {
      await blockIP(ip, 60, "Rapid repeated identical requests (bot behavior)");
      return res.status(429).json({ error: "Too many identical requests" });
    }
    
    IN_MEMORY_REQUEST_TRACKING.set(ip, tracker);
  }
  
  IN_MEMORY_PATTERNS.set(key, now);
  
  if (IN_MEMORY_PATTERNS.size > 10000) {
    const cutoff = now - 60000;
    for (const [k, v] of IN_MEMORY_PATTERNS.entries()) {
      if (v < cutoff) IN_MEMORY_PATTERNS.delete(k);
    }
  }
  
  next();
}

export function headerValidation(req: Request, res: Response, next: NextFunction): void {
  if (!req.path.startsWith('/api')) {
    return next();
  }
  
  const ip = getClientIp(req);
  
  if (!req.headers['user-agent']) {
    console.warn(`[SECURITY] Missing User-Agent from IP: ${ip}`);
  }
  
  const suspiciousHeaders = Object.entries(req.headers).filter(([key, value]) => {
    if (typeof value === 'string') {
      return value.includes('\r') || value.includes('\n');
    }
    return false;
  });
  
  if (suspiciousHeaders.length > 0) {
    console.error(`[SECURITY ALERT] Header injection attempt from IP: ${ip}`);
    blockIP(ip, 360, "HTTP header injection attempt");
    return res.status(400).json({ error: "Invalid request headers" });
  }
  
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, expiry] of IN_MEMORY_BLOCKED_IPS.entries()) {
    if (expiry < now) {
      IN_MEMORY_BLOCKED_IPS.delete(ip);
      console.log(`[SECURITY] Unblocked IP: ${ip}`);
    }
  }
  for (const [ip, data] of IN_MEMORY_REQUEST_TRACKING.entries()) {
    if (now - data.firstRequest > 3600000) {
      IN_MEMORY_REQUEST_TRACKING.delete(ip);
    }
  }
}, 300000);
