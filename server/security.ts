import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import { Request, Response, NextFunction } from "express";

// Extract real IP from Cloudflare headers or fallback to Express IP
export function getClientIp(req: Request): string {
  // Cloudflare provides the real IP in CF-Connecting-IP header
  const cfIp = req.headers['cf-connecting-ip'] as string;
  if (cfIp) return cfIp;
  
  // Fallback to X-Forwarded-For (first IP in chain)
  const forwarded = req.headers['x-forwarded-for'] as string;
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  // Last resort: use Express IP
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// Trust Cloudflare proxy
export function trustCloudflareProxy(req: Request, res: Response, next: NextFunction) {
  // Store real IP for rate limiters
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
  keyGenerator: (req) => getClientIp(req),
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
  keyGenerator: (req) => getClientIp(req),
  skipSuccessfulRequests: false, // Count all requests, even successful ones
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
    return userId ? `user:${userId}` : getClientIp(req);
  },
  skip: (req) => !req.body?.userId, // Only apply if userId is present
});

// Speed limiter - slows down requests gradually to deter attackers
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests at full speed, then start slowing down
  delayMs: (hits) => hits * 100, // Each request adds 100ms delay
  maxDelayMs: 5000, // Max 5 second delay
  keyGenerator: (req) => getClientIp(req),
  skip: (req) => !req.path.startsWith('/api'),
});

// Strict rate limit for failed attempts (bot detection)
export const failedRequestLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Only 10 failed requests per 5 minutes
  message: { error: "Too many failed requests. You have been temporarily blocked." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  skipSuccessfulRequests: true, // Only count failed requests (4xx, 5xx)
});

// Request size limit to prevent payload attacks
export const requestSizeLimit = {
  json: { limit: '10kb' }, // Max 10kb JSON payload
  urlencoded: { extended: false, limit: '10kb' }
};

// Suspicious pattern detection
export function detectSuspiciousPatterns(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
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
    return true; // Don't block if not configured
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
      console.warn(`[SECURITY] Request timeout from IP: ${getClientIp(req)}`);
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
