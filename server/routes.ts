import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp: string;
  footer?: { text: string };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

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

  // Appeal submission endpoint
  app.post("/api/appeals", async (req, res) => {
    try {
      const { userId, denialDate, appealReason, captchaToken } = req.body;

      // Validate Discord user ID (17-19 digits)
      if (!/^\d{17,19}$/.test(userId)) {
        return res.status(400).json({ error: "Invalid Discord user ID format" });
      }

      // Verify hCaptcha token
      const hcaptchaSecret = process.env.HCAPTCHA_SECRET_KEY;
      
      if (!hcaptchaSecret) {
        return res.status(500).json({ error: "Server configuration error: hCaptcha not configured" });
      }

      const verifyResponse = await fetch("https://hcaptcha.com/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `response=${captchaToken}&secret=${hcaptchaSecret}`,
      });

      const verifyData = await verifyResponse.json();

      if (!verifyData.success) {
        return res.status(400).json({ error: "Captcha verification failed" });
      }

      // Store the appeal
      const appeal = {
        userId,
        denialDate,
        appealReason,
        submittedAt: new Date().toISOString(),
      };

      // Send Discord webhook notification
      await sendDiscordWebhook(appeal);

      // Log the appeal
      console.log("New appeal submitted:", appeal);

      res.json({ success: true, message: "Appeal submitted successfully" });
    } catch (error) {
      console.error("Appeal submission error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
