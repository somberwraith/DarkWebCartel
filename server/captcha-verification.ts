import type { Request, Response, NextFunction } from "express";
import { getClientIp } from "./security";

export async function verifyHCaptcha(token: string, ip: string): Promise<{ success: boolean; error?: string }> {
  const secret = process.env.HCAPTCHA_SECRET_KEY;
  
  if (!secret) {
    console.error('[CAPTCHA] hCaptcha secret not configured');
    return { success: false, error: 'CAPTCHA not configured' };
  }
  
  if (!token) {
    return { success: false, error: 'CAPTCHA token missing' };
  }
  
  try {
    const response = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `response=${token}&secret=${secret}&remoteip=${ip}`,
    });
    
    const data = await response.json() as { success: boolean; 'error-codes'?: string[] };
    
    if (!data.success) {
      console.warn(`[CAPTCHA] hCaptcha failed for IP: ${ip}. Errors: ${data['error-codes']?.join(', ')}`);
    }
    
    return { success: data.success, error: data['error-codes']?.join(', ') };
  } catch (error) {
    console.error('[CAPTCHA] hCaptcha verification error:', error);
    return { success: false, error: 'Verification failed' };
  }
}

export async function verifyCloudfareTurnstile(token: string, ip: string): Promise<{ success: boolean; error?: string }> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET;
  
  if (!secret) {
    console.error('[CAPTCHA] Cloudflare Turnstile secret not configured');
    return { success: false, error: 'CAPTCHA not configured' };
  }
  
  if (!token) {
    return { success: false, error: 'CAPTCHA token missing' };
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
    
    const data = await response.json() as { success: boolean; 'error-codes'?: string[] };
    
    if (!data.success) {
      console.warn(`[CAPTCHA] Turnstile failed for IP: ${ip}. Errors: ${data['error-codes']?.join(', ')}`);
    }
    
    return { success: data.success, error: data['error-codes']?.join(', ') };
  } catch (error) {
    console.error('[CAPTCHA] Turnstile verification error:', error);
    return { success: false, error: 'Verification failed' };
  }
}

export async function verifyCaptcha(req: Request): Promise<{ success: boolean; error?: string }> {
  const ip = getClientIp(req);
  
  const hcaptchaToken = req.body?.captchaToken || req.body?.['h-captcha-response'];
  const turnstileToken = req.body?.turnstileToken || req.body?.cfTurnstile || req.headers['cf-turnstile-response'] as string;
  
  if (turnstileToken) {
    return await verifyCloudfareTurnstile(turnstileToken, ip);
  }
  
  if (hcaptchaToken) {
    return await verifyHCaptcha(hcaptchaToken, ip);
  }
  
  if (process.env.CLOUDFLARE_TURNSTILE_SECRET || process.env.HCAPTCHA_SECRET_KEY) {
    return { success: false, error: 'No CAPTCHA token provided' };
  }
  
  console.error('[CAPTCHA] No CAPTCHA system configured - BLOCKING REQUEST (fail closed)');
  return { success: false, error: 'CAPTCHA system not configured' };
}

export async function enforceCaptcha(req: Request, res: Response, next: NextFunction): Promise<void> {
  const result = await verifyCaptcha(req);
  
  if (!result.success) {
    const ip = getClientIp(req);
    console.error(`[SECURITY] CAPTCHA verification failed for IP: ${ip}. Reason: ${result.error}`);
    res.status(403).json({ 
      error: "Bot verification failed. Please complete the CAPTCHA challenge and try again.",
      code: "CAPTCHA_FAILED",
      details: result.error
    });
    return;
  }
  
  next();
}
