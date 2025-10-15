import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import {
  globalRateLimit,
  speedLimiter,
  trustCloudflareProxy,
  detectSuspiciousPatterns,
  requestTimeout,
  requestSizeLimit,
} from "./security";
import {
  ipBlockingMiddleware,
  connectionFloodDetection,
  fingerprintAnomalyDetection,
  setupHoneypot,
  payloadBombProtection,
  httpMethodValidation,
  pathTraversalDetection,
  rapidRepeatDetection,
  headerValidation,
} from "./advanced-security";

const app = express();

// ======================
// MILITARY-GRADE SECURITY MIDDLEWARE (Order matters!)
// ======================

// 1. Trust Cloudflare proxy and extract real IP
app.set('trust proxy', true); // Trust first proxy (Cloudflare)
app.use(trustCloudflareProxy);

// 2. IP blocking system (check first, before processing anything)
app.use(ipBlockingMiddleware);

// 3. HTTP method validation (block invalid methods)
app.use(httpMethodValidation);

// 4. Path traversal detection
app.use(pathTraversalDetection);

// 5. Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.hcaptcha.com", "https://challenges.cloudflare.com"],
      frameSrc: ["'self'", "https://hcaptcha.com", "https://*.hcaptcha.com", "https://challenges.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://hcaptcha.com"],
      connectSrc: ["'self'", "https://hcaptcha.com", "https://*.hcaptcha.com"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true,
}));

// 6. Request size limits (prevent payload bombs)
app.use(express.json(requestSizeLimit.json));
app.use(express.urlencoded(requestSizeLimit.urlencoded));

// 7. Payload bomb protection (check depth and complexity)
app.use(payloadBombProtection);

// 8. Sanitize NoSQL injection attempts
app.use(mongoSanitize());

// 9. Prevent HTTP Parameter Pollution
app.use(hpp());

// 10. Header validation (detect injection attempts)
app.use(headerValidation);

// 11. Request timeout protection (30 seconds max)
app.use(requestTimeout(30000));

// 12. Connection flood detection (detect rapid fire attacks)
app.use(connectionFloodDetection);

// 13. Rapid repeat detection (identical requests)
app.use(rapidRepeatDetection);

// 14. Request fingerprint anomaly detection
app.use(fingerprintAnomalyDetection);

// 15. Speed limiter - gradually slow down heavy users
app.use(speedLimiter);

// 16. Global rate limiting
app.use(globalRateLimit);

// 17. Suspicious pattern detection (SQL injection, XSS, etc.)
app.use(detectSuspiciousPatterns);

// 18. Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const ip = req.clientIp || req.ip;
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms [${ip}]`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 100) {
        logLine = logLine.slice(0, 99) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Setup honeypot traps (instant block for malicious access)
  setupHoneypot(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 80 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '80', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`🚀 Server running on port ${port}`);
    log(`🔒 MILITARY-GRADE SECURITY ACTIVE:`);
    log(`   ✓ 18 Security Layers`);
    log(`   ✓ Multi-Tier Rate Limiting`);
    log(`   ✓ DDoS Protection`);
    log(`   ✓ Bot Detection & Blocking`);
    log(`   ✓ Honeypot Traps`);
    log(`   ✓ Request Fingerprinting`);
    log(`   ✓ Anomaly Detection`);
    log(`   ✓ Auto IP Blocking`);
  });
})();
