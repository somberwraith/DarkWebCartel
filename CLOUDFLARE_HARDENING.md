# Cloudflare DDoS Protection & Hardening Guide

This guide covers how to harden your application defenses through Cloudflare DNS and security features.

## 🛡️ Essential Cloudflare Security Features

### 1. DNS Configuration

#### A. Proxy Status (Orange Cloud)
- **Enable**: Click the orange cloud icon next to your DNS records
- **Benefits**: 
  - Hides your origin server IP
  - Routes all traffic through Cloudflare's network
  - Enables all security features

#### B. DNS Records Setup
```
Type: A
Name: @ (or your subdomain)
IPv4: YOUR_AZURE_VPS_IP
Proxy status: ✅ Proxied (Orange cloud)
TTL: Auto
```

### 2. WAF (Web Application Firewall) Rules

Navigate to: **Security → WAF → Managed Rules**

#### Enable These Rulesets:
- ✅ **Cloudflare Managed Ruleset** - Protection against common attacks
- ✅ **Cloudflare OWASP Core Ruleset** - OWASP Top 10 protection
- ✅ **Cloudflare Exposed Credentials Check** - Credential stuffing protection

### 3. DDoS Protection Settings

Navigate to: **Security → DDoS**

#### Configure:
- **DDoS Attack Protection**: ✅ Enabled (default)
- **Sensitivity Level**: High (for maximum protection)
- **Advanced Protection**: Enable HTTP DDoS Attack Protection

### 4. Rate Limiting (Cloudflare Level)

Navigate to: **Security → WAF → Rate limiting rules**

#### Create Rule 1: Global API Protection
```yaml
Rule name: Global API Rate Limit
Field: URI Path
Operator: contains
Value: /api/
Characteristics: IP
Period: 10 seconds
Requests: 20
Action: Block
Duration: 600 seconds (10 minutes)
```

#### Create Rule 2: Appeals Endpoint Protection
```yaml
Rule name: Appeals Strict Limit
Field: URI Path
Operator: equals
Value: /api/appeals
Characteristics: IP
Period: 3600 seconds (1 hour)
Requests: 5
Action: Block
Duration: 3600 seconds (1 hour)
```

### 5. Bot Fight Mode / Bot Management

Navigate to: **Security → Bots**

#### Free Plan:
- Enable **Bot Fight Mode**
  - Blocks known bad bots
  - Challenges suspicious traffic

#### Pro/Business Plan (Recommended):
- Enable **Super Bot Fight Mode**
  - Machine learning detection
  - JavaScript detections
  - More aggressive protection

### 6. Security Level

Navigate to: **Security → Settings**

```yaml
Security Level: High
  - Challenges visitors with a threat score above 0
  - Recommended for sites under attack

Challenge Passage: 30 minutes
  - How long users can browse without re-challenging
```

### 7. Browser Integrity Check

Navigate to: **Security → Settings**

- ✅ **Browser Integrity Check**: Enabled
  - Blocks requests with suspicious headers
  - Prevents common bot patterns

### 8. Turnstile (Better than hCaptcha)

Navigate to: **Turnstile** (in sidebar)

#### Setup:
1. Click **Add Site**
2. Configure:
   ```yaml
   Site name: CARTEL Appeals
   Domain: yourdomain.com
   Widget Mode: Managed (Recommended)
   ```
3. Copy **Site Key** → Add to `.env` as `VITE_CLOUDFLARE_TURNSTILE_SITEKEY`
4. Copy **Secret Key** → Add to `.env` as `CLOUDFLARE_TURNSTILE_SECRET`

#### Update Frontend (Optional - More Secure):
Replace hCaptcha with Turnstile in `/client/src/pages/appeal.tsx`:
```html
<!-- Replace hCaptcha script with: -->
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>

<!-- Replace hCaptcha div with: -->
<div class="cf-turnstile" data-sitekey="YOUR_SITE_KEY" data-callback="onSuccess"></div>
```

### 9. Firewall Rules (Custom Rules)

Navigate to: **Security → WAF → Custom rules**

#### Rule 1: Block Known Bad User Agents
```yaml
Rule name: Block Bad Bots
Expression:
  (http.user_agent contains "curl") or 
  (http.user_agent contains "wget") or 
  (http.user_agent contains "python-requests") or
  (http.user_agent contains "go-http-client")
Action: Block
```

#### Rule 2: Block Requests Without User Agent
```yaml
Rule name: Require User Agent
Expression:
  (http.request.uri.path contains "/api/") and 
  (not http.user_agent)
Action: Block
```

#### Rule 3: Geographic Restrictions (if applicable)
```yaml
Rule name: Geographic Block
Expression:
  (http.request.uri.path eq "/api/appeals") and 
  (ip.geoip.country in {"CN" "RU" "KP"})  # Add countries to block
Action: Block
```

#### Rule 4: Challenge Suspicious IPs
```yaml
Rule name: Challenge Tor Users
Expression:
  (cf.threat_score > 10) and 
  (http.request.uri.path contains "/api/")
Action: Managed Challenge
```

### 10. Page Rules (Performance & Security)

Navigate to: **Rules → Page Rules**

#### Rule 1: API Caching (Disable)
```yaml
URL Pattern: *yourdomain.com/api/*
Settings:
  - Cache Level: Bypass
  - Security Level: High
```

#### Rule 2: Static Assets (Enable Caching)
```yaml
URL Pattern: *yourdomain.com/*.{jpg,jpeg,png,gif,css,js}
Settings:
  - Cache Level: Standard
  - Browser Cache TTL: 4 hours
```

### 11. SSL/TLS Configuration

Navigate to: **SSL/TLS → Overview**

```yaml
Encryption Mode: Full (strict)
  - Requires valid SSL certificate on origin server
  - Most secure option

Minimum TLS Version: TLS 1.2
  - Blocks outdated protocols
```

Navigate to: **SSL/TLS → Edge Certificates**
- ✅ Always Use HTTPS: Enabled
- ✅ HTTP Strict Transport Security (HSTS): Enabled
  - Max Age: 12 months
  - Include subdomains: Yes
  - Preload: Yes

### 12. Advanced DDoS Attack Response

Navigate to: **Security → DDoS → Advanced**

```yaml
HTTP DDoS Attack Protection:
  - Sensitivity: High
  - Action: Block

Layer 7 DDoS Mitigation:
  - Advanced rate limiting
  - Pattern detection
  - Automatic mitigation
```

### 13. IP Access Rules (Emergency)

Navigate to: **Security → WAF → Tools**

#### Block Specific IPs Under Attack:
```yaml
Value: 192.168.1.1 (attacker IP)
Action: Block
Zone: This website
Note: "DDoS attacker - blocked 2024-01-15"
```

### 14. Analytics & Monitoring

Navigate to: **Analytics → Security**

Monitor:
- Threat analytics
- Firewall events
- Rate limiting events
- Bot traffic patterns
- Top attacking IPs/countries

Set up **Notifications**:
- Navigate to **Notifications**
- Enable: "Advanced DDoS Attack Alert"
- Enable: "Firewall Events Alert"

## 🚨 Under Active Attack Checklist

If you're currently being DDoS'd:

1. **Enable "Under Attack Mode"**
   - Navigate to **Security → Settings**
   - Click **Under Attack Mode**
   - Shows interstitial page to all visitors for 5 seconds
   - Blocks most bots immediately

2. **Temporarily Block All API Access**
   - Create firewall rule:
   ```yaml
   Expression: (http.request.uri.path contains "/api/")
   Action: Block
   ```
   - Re-enable after attack subsides

3. **Enable IP Geolocation Blocking**
   - Check **Analytics → Security** for attacking country
   - Block entire country if attack is concentrated

4. **Contact Cloudflare Support**
   - If on Pro/Business plan
   - Request manual review and assistance

## 🔐 Environment Variables Required

Add these to your `.env` file:

```bash
# Cloudflare Turnstile (Optional but recommended)
CLOUDFLARE_TURNSTILE_SECRET=your_turnstile_secret_key
VITE_CLOUDFLARE_TURNSTILE_SITEKEY=your_turnstile_site_key

# hCaptcha (Current)
HCAPTCHA_SECRET_KEY=your_hcaptcha_secret
VITE_HCAPTCHA_SITEKEY=your_hcaptcha_sitekey

# Discord Webhook
DISCORD_WEBHOOK_URL=your_discord_webhook_url
```

## 📊 Expected Results

After implementing all measures:
- **99.9%** of bot traffic blocked
- **DDoS attacks** mitigated automatically
- **Legitimate users** experience minimal friction
- **Origin server** protected from direct attacks
- **IP address** hidden from attackers

## ⚠️ Important Notes

1. **Cloudflare Proxy**: MUST be enabled (orange cloud) for all protection features
2. **Origin IP**: Keep your Azure VPS IP secret. If leaked, change it immediately
3. **Rate Limits**: Stack multiple layers (Cloudflare + Application) for best protection
4. **Monitoring**: Check analytics daily during/after attacks
5. **Free vs Paid**: Many advanced features require Pro ($20/month) or Business plan

## 🎯 Recommended Plan

For maximum protection against serious DDoS attacks:
- **Cloudflare Pro Plan**: $20/month
  - WAF with custom rules
  - Advanced DDoS protection
  - Priority support
  - Super Bot Fight Mode
