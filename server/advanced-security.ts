import { Request, Response, NextFunction } from "express";
import { getClientIp } from "./security";

// In-memory store for tracking requests and blocking (use Redis in production for distributed systems)
interface RequestTracker {
  count: number;
  firstRequest: number;
  blocked: boolean;
  blockExpiry?: number;
  fingerprint?: string;
  violations: number;
}

const requestTracking = new Map<string, RequestTracker>();
const blockedIPs = new Map<string, number>(); // IP -> expiry timestamp
const suspiciousPatterns = new Map<string, number>(); // Pattern -> count

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  
  // Clean expired blocks
  for (const [ip, expiry] of Array.from(blockedIPs.entries())) {
    if (expiry < now) {
      blockedIPs.delete(ip);
      console.log(`[SECURITY] Unblocked IP: ${ip}`);
    }
  }
  
  // Clean old tracking data (older than 1 hour)
  for (const [ip, data] of Array.from(requestTracking.entries())) {
    if (now - data.firstRequest > 3600000) {
      requestTracking.delete(ip);
    }
  }
}, 300000);

// Advanced request fingerprinting
export function generateRequestFingerprint(req: Request): string {
  const components = [
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
    req.headers['accept'] || '',
    // Don't include IP in fingerprint - we track that separately
  ];
  
  return Buffer.from(components.join('|')).toString('base64').substring(0, 32);
}

// Aggressive IP blocking system
export function ipBlockingMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const blocked = blockedIPs.get(ip);
  
  if (blocked && blocked > Date.now()) {
    const remainingMinutes = Math.ceil((blocked - Date.now()) / 60000);
    console.warn(`[SECURITY] Blocked IP attempted access: ${ip} (${remainingMinutes} min remaining)`);
    return res.status(403).json({ 
      error: "Access forbidden. Your IP has been temporarily blocked due to suspicious activity.",
      retryAfter: remainingMinutes 
    });
  }
  
  // Clean expired block
  if (blocked && blocked <= Date.now()) {
    blockedIPs.delete(ip);
  }
  
  next();
}

// Block an IP for a specified duration (in minutes)
export function blockIP(ip: string, durationMinutes: number = 60, reason: string = "Suspicious activity") {
  const expiry = Date.now() + (durationMinutes * 60000);
  blockedIPs.set(ip, expiry);
  console.error(`[SECURITY BLOCK] IP ${ip} blocked for ${durationMinutes} minutes. Reason: ${reason}`);
}

// Connection flood detection - detect too many requests in short time
export function connectionFloodDetection(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api')) {
    return next();
  }
  
  const ip = getClientIp(req);
  const now = Date.now();
  const tracker = requestTracking.get(ip) || {
    count: 0,
    firstRequest: now,
    blocked: false,
    violations: 0
  };
  
  // Reset counter if time window passed (10 seconds)
  if (now - tracker.firstRequest > 10000) {
    tracker.count = 0;
    tracker.firstRequest = now;
    tracker.violations = 0;
  }
  
  tracker.count++;
  
  // AGGRESSIVE: More than 30 requests in 10 seconds = instant block
  if (tracker.count > 30) {
    tracker.violations++;
    
    // Block for increasing durations based on violations
    const blockDuration = Math.min(tracker.violations * 30, 1440); // Max 24 hours
    blockIP(ip, blockDuration, `Connection flood: ${tracker.count} requests in 10 seconds`);
    
    return res.status(429).json({ 
      error: "Request flood detected. IP blocked.",
      blocked: true
    });
  }
  
  // WARNING: More than 20 requests in 10 seconds = warning
  if (tracker.count > 20) {
    console.warn(`[SECURITY] Potential flood from IP: ${ip} (${tracker.count} requests in 10s)`);
  }
  
  requestTracking.set(ip, tracker);
  next();
}

// Request fingerprint anomaly detection
export function fingerprintAnomalyDetection(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api')) {
    return next();
  }
  
  const ip = getClientIp(req);
  const fingerprint = generateRequestFingerprint(req);
  const tracker = requestTracking.get(ip);
  
  if (tracker) {
    // Check if fingerprint changed (possible bot rotating user agents)
    if (tracker.fingerprint && tracker.fingerprint !== fingerprint) {
      console.warn(`[SECURITY] Fingerprint change detected for IP: ${ip}`);
      tracker.violations = (tracker.violations || 0) + 1;
      
      // Multiple fingerprint changes = block
      if (tracker.violations > 3) {
        blockIP(ip, 120, "Multiple fingerprint changes detected (bot behavior)");
        return res.status(403).json({ error: "Suspicious activity detected" });
      }
    }
    
    tracker.fingerprint = fingerprint;
    requestTracking.set(ip, tracker);
  }
  
  next();
}

// Honeypot endpoint - any access to this is 100% malicious
export function setupHoneypot(app: any) {
  const honeypotPaths = [
    // WordPress/CMS attacks
    '/wp-admin',
    '/wp-login.php',
    '/wp-config.php',
    '/xmlrpc.php',
    '/admin',
    '/administrator',
    '/admin.php',
    
    // Database/Config files
    '/phpmyadmin',
    '/.env',
    '/.env.production',
    '/.git/config',
    '/config.php',
    '/configuration.php',
    
    // API Documentation/Discovery (COMMON ATTACK VECTOR!)
    '/api/swagger',
    '/swagger',
    '/swagger.json',
    '/swagger.yaml',
    '/swagger/v1/swagger.json',
    '/swagger/v2/swagger.json',
    '/api-docs',
    '/api/docs',
    '/docs',
    '/graphql',
    '/api/graphql',
    '/v1/api-docs',
    '/v2/api-docs',
    '/openapi.json',
    '/api.json',
    
    // Common scanning paths
    '/backup',
    '/backup.sql',
    '/backup.zip',
    '/database.sql',
    '/.git',
    '/.svn',
    '/.htaccess',
    '/web.config',
    '/server-status',
    '/server-info',
  ];
  
  honeypotPaths.forEach(path => {
    app.all(path, (req: Request, res: Response) => {
      const ip = getClientIp(req);
      console.error(`[HONEYPOT] Malicious access attempt to ${path} from IP: ${ip}`);
      
      // Instant 24-hour block for honeypot access
      blockIP(ip, 1440, `Honeypot triggered: ${path}`);
      
      // Return 404 to not reveal it's a honeypot
      res.status(404).send('Not Found');
    });
  });
}

// Payload bomb protection - detect suspiciously large or complex payloads
export function payloadBombProtection(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    // Already limited to 10kb in main config, but double-check
    if (contentLength > 10240) {
      const ip = getClientIp(req);
      console.warn(`[SECURITY] Large payload detected from IP: ${ip} (${contentLength} bytes)`);
      blockIP(ip, 30, "Payload bomb attempt");
      return res.status(413).json({ error: "Payload too large" });
    }
    
    // Check for deeply nested JSON (billion laughs attack)
    if (req.body && typeof req.body === 'object') {
      const depth = getObjectDepth(req.body);
      if (depth > 10) {
        const ip = getClientIp(req);
        console.error(`[SECURITY] Deeply nested payload from IP: ${ip} (depth: ${depth})`);
        blockIP(ip, 60, "Deeply nested payload (potential attack)");
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

// Request method validation - block unusual HTTP methods
export function httpMethodValidation(req: Request, res: Response, next: NextFunction) {
  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  
  if (!allowedMethods.includes(req.method)) {
    const ip = getClientIp(req);
    console.warn(`[SECURITY] Invalid HTTP method ${req.method} from IP: ${ip}`);
    blockIP(ip, 15, `Invalid HTTP method: ${req.method}`);
    return res.status(405).json({ error: "Method not allowed" });
  }
  
  next();
}

// Path traversal attack detection
export function pathTraversalDetection(req: Request, res: Response, next: NextFunction) {
  const path = req.path.toLowerCase();
  const traversalPatterns = ['../', '..\\', '%2e%2e', '%252e', '%c0%ae', '%c1%9c'];
  
  if (traversalPatterns.some(pattern => path.includes(pattern))) {
    const ip = getClientIp(req);
    console.error(`[SECURITY ALERT] Path traversal attempt from IP: ${ip}, Path: ${req.path}`);
    blockIP(ip, 180, "Path traversal attack attempt");
    return res.status(400).json({ error: "Invalid request path" });
  }
  
  next();
}

// Rapid repeated request detection (same request multiple times)
export function rapidRepeatDetection(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api')) {
    return next();
  }
  
  const ip = getClientIp(req);
  const requestSignature = `${req.method}:${req.path}:${JSON.stringify(req.body || {})}`;
  const key = `${ip}:${requestSignature}`;
  
  const lastRequest = suspiciousPatterns.get(key) || 0;
  const now = Date.now();
  
  // Same exact request within 1 second = suspicious
  if (now - lastRequest < 1000) {
    console.warn(`[SECURITY] Rapid repeat request from IP: ${ip}`);
    const tracker = requestTracking.get(ip) || { count: 0, firstRequest: now, blocked: false, violations: 0 };
    tracker.violations = (tracker.violations || 0) + 1;
    
    if (tracker.violations > 5) {
      blockIP(ip, 60, "Rapid repeated identical requests (bot behavior)");
      return res.status(429).json({ error: "Too many identical requests" });
    }
    
    requestTracking.set(ip, tracker);
  }
  
  suspiciousPatterns.set(key, now);
  
  // Clean old patterns
  if (suspiciousPatterns.size > 10000) {
    const cutoff = now - 60000;
    for (const [k, v] of Array.from(suspiciousPatterns.entries())) {
      if (v < cutoff) suspiciousPatterns.delete(k);
    }
  }
  
  next();
}

// Header validation - detect missing or suspicious headers
export function headerValidation(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api')) {
    return next();
  }
  
  const ip = getClientIp(req);
  
  // Check for required headers
  if (!req.headers['user-agent']) {
    console.warn(`[SECURITY] Missing User-Agent from IP: ${ip}`);
    // Don't block immediately, but log it
  }
  
  // Check for header injection attempts
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

// Export blocked IPs for monitoring
export function getBlockedIPs(): Array<{ ip: string; expiresAt: number; reason: string }> {
  const result: Array<{ ip: string; expiresAt: number; reason: string }> = [];
  for (const [ip, expiry] of Array.from(blockedIPs.entries())) {
    result.push({ ip, expiresAt: expiry, reason: 'Security violation' });
  }
  return result;
}

// Manual unblock function (for admin use)
export function unblockIP(ip: string): boolean {
  if (blockedIPs.has(ip)) {
    blockedIPs.delete(ip);
    console.log(`[SECURITY] Manually unblocked IP: ${ip}`);
    return true;
  }
  return false;
}
