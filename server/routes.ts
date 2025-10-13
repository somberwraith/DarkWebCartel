import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  // Appeal submission endpoint
  app.post("/api/appeals", async (req, res) => {
    try {
      const { userId, denialDate, appealReason, whenToJoin, captchaToken } = req.body;

      // Verify hCaptcha token
      const hcaptchaSecret = process.env.HCAPTCHA_SECRET_KEY;
      if (!hcaptchaSecret) {
        return res.status(500).json({ error: "Server configuration error" });
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

      // Store the appeal (you can modify this to use your storage interface)
      const appeal = {
        userId,
        denialDate,
        appealReason,
        whenToJoin,
        submittedAt: new Date().toISOString(),
      };

      // Log or store the appeal
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
