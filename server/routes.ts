import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  appealsRateLimit,
  perUserAppealsLimit,
  failedRequestLimiter,
  getClientIp,
} from "./security";
import {
  getBlockedIPs,
  unblockIP,
} from "./advanced-security";

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp: string;
  footer?: { text: string };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint (for monitoring and auto-restart)
  app.get("/health", (req, res) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    res.json({
      status: "healthy",
      uptime: Math.floor(uptime),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + "MB",
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + "MB"
      },
      timestamp: new Date().toISOString()
    });
  });

  // Security monitoring endpoint - view blocked IPs
  app.get("/api/security/blocked-ips", (req, res) => {
    const blockedIPs = getBlockedIPs();
    res.json({
      total: blockedIPs.length,
      ips: blockedIPs,
      timestamp: new Date().toISOString()
    });
  });

  // Security admin endpoint - unblock an IP (use with caution)
  app.post("/api/security/unblock", (req, res) => {
    const { ip, adminKey } = req.body;

    // Simple admin key check (use proper auth in production)
    if (adminKey !== process.env.SECURITY_ADMIN_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const success = unblockIP(ip);
    if (success) {
      console.log(`[ADMIN] IP unblocked: ${ip}`);
      res.json({ success: true, message: `IP ${ip} unblocked` });
    } else {
      res.json({ success: false, message: `IP ${ip} was not blocked` });
    }
  });

  // Function to send Discord webhook
  async function sendDiscordWebhook(appeal: {
    userId: string;
    denialDate: string;
    appealReason: string;
    submittedAt: string;
  }) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
      console.log("No Discord webhook URL configured, skipping notification");
      return;
    }

    const embed: DiscordEmbed = {
      title: "🔔 New Appeal Submitted",
      color: 0x00ff00, // Green color
      fields: [
        {
          name: "Discord User ID",
          value: `\`${appeal.userId}\``,
          inline: true
        },
        {
          name: "Denial Date",
          value: appeal.denialDate,
          inline: true
        },
        {
          name: "Appeal Reason",
          value: appeal.appealReason.length > 1024 
            ? appeal.appealReason.substring(0, 1021) + "..." 
            : appeal.appealReason,
          inline: false
        }
      ],
      timestamp: appeal.submittedAt,
      footer: {
        text: "CARTEL Appeal System"
      }
    };

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "CARTEL Appeals",
          embeds: [embed]
        })
      });
      console.log("Discord webhook sent successfully");
    } catch (error) {
      console.error("Failed to send Discord webhook:", error);
    }
  }

  // Appeal submission endpoint with AGGRESSIVE rate limiting
  app.post("/api/appeals", 
    appealsRateLimit,        // IP-based: 3 requests per hour
    perUserAppealsLimit,     // User-based: 5 requests per day per Discord ID
    failedRequestLimiter,    // Failed attempts: 10 per 5 minutes
    async (req, res) => {
      const clientIp = getClientIp(req);

      try {
        const { userId, denialDate, appealReason } = req.body; // Removed captchaToken

        // Validate required fields
        if (!userId || !denialDate || !appealReason) {
          console.warn(`[SECURITY] Missing required fields from IP: ${clientIp}`);
          return res.status(400).json({ error: "All fields are required" });
        }

        // Validate Discord user ID (17-19 digits)
        if (!/^\d{17,19}$/.test(userId)) {
          console.warn(`[SECURITY] Invalid Discord ID format from IP: ${clientIp}`);
          return res.status(400).json({ error: "Invalid Discord user ID format" });
        }

        // Validate appeal reason length (prevent spam)
        if (appealReason.length < 10) {
          return res.status(400).json({ error: "Appeal reason must be at least 10 characters" });
        }

        if (appealReason.length > 2000) {
          return res.status(400).json({ error: "Appeal reason must be less than 2000 characters" });
        }

        // CAPTCHA verification removed as per user request

        // Store the appeal
        const appeal = {
          userId,
          denialDate,
          appealReason,
          submittedAt: new Date().toISOString(),
        };

        // Send Discord webhook notification (async, don't wait)
        sendDiscordWebhook(appeal).catch(err => 
          console.error("Discord webhook error:", err)
        );

        // Log the appeal with IP
        console.log(`[APPEAL] New appeal from User: ${userId}, IP: ${clientIp}`);

        res.json({ success: true, message: "Appeal submitted successfully" });
      } catch (error) {
        console.error(`[ERROR] Appeal submission error from IP: ${clientIp}:`, error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  const httpServer = createServer(app);

  return httpServer;
}