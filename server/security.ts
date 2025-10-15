import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import { Request, Response, NextFunction } from "express";
import ipRangeCheck from "ip-range-check";

// Cloudflare IP ranges (updated periodically from https://www.cloudflare.com/ips/)
const CLOUDFLARE_IPV4_RANGES = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22'
];

const CLOUDFLARE_IPV6_RANGES = [
  '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
  '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32'
];

// SECURE: Validate request is actually from Cloudflare using CIDR ranges
function isCloudflareIP(ip: string): boolean {
  // Localhost/development bypass
  if (ip === '127.0.0.1' || ip === 'localhost' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return true;
  }
  
  // Check against Cloudflare IPv4 ranges
  if (ip.includes('.')) {
    return ipRangeCheck(ip, CLOUDFLARE_IPV4_RANGES);
  }
  
  // Check against Cloudflare IPv6 ranges
  if (ip.includes(':')) {
    return ipRangeCheck(ip, CLOUDFLARE_IPV6_RANGES);
  }
  
  return false;
}

// Extract real IP from Cloudflare headers ONLY if request comes from Cloudflare
export function getClientIp(req: Request): string {
  const remoteIp = req.socket.remoteAddress || 'unknown';
  
  // SECURITY: Only trust CF headers if request is from Cloudflare IP
  if (isCloudflareIP(remoteIp)) {
    // Cloudflare provides the real IP in CF-Connecting-IP header
    const cfIp = req.headers['cf-connecting-ip'] as string;
    if (cfIp) return cfIp;
    
    // Fallback to X-Forwarded-For (first IP in chain)
    const forwarded = req.headers['x-forwarded-for'] as string;
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
  } else {
    // SECURITY: Log and reject spoofed Cloudflare headers from non-CF IPs
    const fakeHeaders = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'];
    if (fakeHeaders) {
      console.error(`[SECURITY ALERT] Header spoofing attempt from ${remoteIp}, fake headers: ${fakeHeaders}`);
    }
  }
  
  // If not from Cloudflare, use socket IP (prevents header spoofing)
  return remoteIp;
}

// Trust Cloudflare proxy - SECURE VERSION with validation
export function trustCloudflareProxy(req: Request, res: Response, next: NextFunction) {
  const remoteIp = req.socket.remoteAddress || 'unknown';
  
  // Validate request is from Cloudflare before trusting headers
  if (!isCloudflareIP(remoteIp)) {
    // Check for spoofed Cloudflare headers
    const fakeHeaders = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'];
    if (fakeHeaders) {
      console.error(`[SECURITY ALERT] Non-Cloudflare IP ${remoteIp} attempting to spoof headers: ${fakeHeaders}`);
      // Block immediately - this is a clear attack
      return res.status(403).json({ error: "Access denied" });
    }
  }
  
  // Store validated real IP for rate limiters
  req.clientIp = getClientIp(req);
  next();
}

// Global rate limiter - prevents brute force across the entire API
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per 15 minutes per IP
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.clientIp || getClientIp(req),
  skip: (req) => {
    // Skip rate limiting for static assets
    return !req.path.startsWith('/api');
  }
});

// Aggressive rate limit for appeals endpoint specifically
export const appealsRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 3, // Only 3 appeals per hour per IP
  message: { error: "Too many appeal submissions. You can submit up to 3 appeals per hour." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.clientIp || getClientIp(req),
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

// Per-user rate limit (based on Discord ID)
export const perUserAppealsLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // Max 5 appeals per Discord user per day
  message: { error: "This Discord user has submitted too many appeals today. Maximum 5 per day." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.body?.userId;
    return userId ? `user:${userId}` : (req.clientIp || getClientIp(req));
  },
  skip: (req) => !req.body?.userId,
});

// Speed limiter - slows down requests gradually to deter attackers
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests at full speed
  delayMs: (hits) => hits * 100, // Each request adds 100ms delay
  maxDelayMs: 5000, // Max 5 second delay
  keyGenerator: (req) => req.clientIp || getClientIp(req),
  skip: (req) => !req.path.startsWith('/api'),
});

// Strict rate limit for failed attempts (bot detection)
export const failedRequestLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Only 10 failed requests per 5 minutes
  message: { error: "Too many failed requests. You have been temporarily blocked." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.clientIp || getClientIp(req),
  skipSuccessfulRequests: true,
});

// Request size limit to prevent payload attacks
export const requestSizeLimit = {
  json: { limit: '10kb' },
  urlencoded: { extended: false, limit: '10kb' }
};

// Suspicious pattern detection
export function detectSuspiciousPatterns(req: Request, res: Response, next: NextFunction) {
  const ip = req.clientIp || getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  
  // Check for missing user agent (common in bots)
  if (!userAgent && req.path.startsWith('/api')) {
    console.warn(`[SECURITY] Missing User-Agent from IP: ${ip}`);
  }
  
  // Check for suspicious user agents
  const suspiciousAgents = ['curl', 'wget', 'python-requests', 'go-http-client'];
  if (suspiciousAgents.some(agent => userAgent.toLowerCase().includes(agent))) {
    console.warn(`[SECURITY] Suspicious User-Agent detected: ${userAgent} from IP: ${ip}`);
  }
  
  // Detect SQL injection attempts in query params and body
  const allParams = JSON.stringify({ ...req.query, ...req.body });
  const sqlPatterns = /(\bUNION\b|\bSELECT\b|\bDROP\b|\bINSERT\b|\bDELETE\b|\bUPDATE\b|--|\bOR\b\s+\d+\s*=\s*\d+)/i;
  
  if (sqlPatterns.test(allParams)) {
    console.error(`[SECURITY ALERT] SQL injection attempt from IP: ${ip}`);
    return res.status(400).json({ error: "Invalid request parameters" });
  }
  
  // Detect XSS attempts
  const xssPatterns = /<script|javascript:|onerror=|onload=/i;
  if (xssPatterns.test(allParams)) {
    console.error(`[SECURITY ALERT] XSS attempt from IP: ${ip}`);
    return res.status(400).json({ error: "Invalid request parameters" });
  }
  
  next();
}

// Cloudflare Turnstile verification (more robust than hCaptcha for DDoS)
export async function verifyCloudfareTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET;
  
  if (!secret) {
    console.warn('[SECURITY] Cloudflare Turnstile not configured, skipping verification');
    return true;
  }
  
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: ip,
      }),
    });
    
    const data = await response.json() as { success: boolean };
    return data.success;
  } catch (error) {
    console.error('[SECURITY] Turnstile verification error:', error);
    return false;
  }
}

// Request timeout protection
export function requestTimeout(timeout: number = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    req.setTimeout(timeout, () => {
      const ip = req.clientIp || getClientIp(req);
      console.warn(`[SECURITY] Request timeout from IP: ${ip}`);
      res.status(408).json({ error: "Request timeout" });
    });
    next();
  };
}

// Extend Express Request type to include clientIp
declare global {
  namespace Express {
    interface Request {
      clientIp?: string;
    }
  }
}
