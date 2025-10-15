# Azure Ubuntu 24.04 VPS Setup Guide - Production Deployment

Complete guide for deploying your CARTEL Appeals application on Azure with military-grade security.

## 📋 Prerequisites

- Azure account with active subscription
- Domain name configured in Cloudflare
- SSH client (terminal on Mac/Linux, PuTTY on Windows)
- Basic command-line knowledge

---

## 🚀 Part 1: Azure VPS Setup

### Step 1: Create Ubuntu 24.04 VPS on Azure

1. **Login to Azure Portal**
   - Go to https://portal.azure.com

2. **Create Virtual Machine**
   - Click "Create a resource" → "Virtual Machine"
   - **Basics Configuration:**
     ```
     Resource Group: Create new (e.g., "cartel-appeals-rg")
     VM Name: cartel-appeals-server
     Region: Choose closest to your users
     Image: Ubuntu Server 24.04 LTS
     Size: Standard_B2s (2 vCPUs, 4GB RAM) - Minimum recommended
           Standard_B2ms (2 vCPUs, 8GB RAM) - Better for production
     ```

3. **Authentication:**
   - Authentication type: **SSH public key**
   - Username: `azureuser` (or your preferred username)
   - SSH public key source: Generate new key pair
   - Key pair name: `cartel-appeals-key`
   - **Download and save the private key (.pem file)**

4. **Inbound Port Rules:**
   ```
   ✅ SSH (22)
   ✅ HTTP (80)
   ✅ HTTPS (443)
   ```

5. **Disks:**
   - OS disk type: **Premium SSD** (recommended for production)
   - Size: 30 GB minimum

6. **Networking:**
   - Virtual network: Create new (default is fine)
   - Public IP: Create new (Static)
   - NIC network security group: Basic
   - Select inbound ports: 22, 80, 443

7. **Review + Create**
   - Review settings
   - Click "Create"
   - **IMPORTANT:** Download the SSH private key when prompted

### Step 2: Configure DNS in Cloudflare

1. **Get Your Azure VM Public IP:**
   - Go to your VM in Azure Portal
   - Copy the Public IP address (e.g., 20.123.45.67)

2. **Add DNS Record in Cloudflare:**
   - Login to Cloudflare
   - Select your domain
   - Go to DNS settings
   - Add A Record:
     ```
     Type: A
     Name: @ (for root domain) or appeals (for subdomain)
     IPv4 address: YOUR_AZURE_PUBLIC_IP
     Proxy status: ✅ Proxied (Orange cloud)
     TTL: Auto
     ```

3. **Wait for DNS Propagation** (1-5 minutes)

---

## 🔧 Part 2: Server Initial Setup

### Step 3: Connect to Your Server

**On Mac/Linux:**
```bash
# Set proper permissions for SSH key
chmod 400 ~/Downloads/cartel-appeals-key.pem

# Connect to server
ssh -i ~/Downloads/cartel-appeals-key.pem azureuser@YOUR_AZURE_PUBLIC_IP
```

**On Windows (PowerShell):**
```powershell
ssh -i C:\Users\YourName\Downloads\cartel-appeals-key.pem azureuser@YOUR_AZURE_PUBLIC_IP
```

### Step 4: Initial Server Hardening

Once connected, run these commands:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git ufw fail2ban

# Configure UFW Firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status

# Configure Fail2Ban (blocks brute force SSH attacks)
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Create swap file (recommended for 4GB RAM or less)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 📦 Part 3: Install Application Dependencies

### Step 5: Install Node.js 20

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version
```

### Step 6: Install PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Configure PM2 to start on boot
pm2 startup
# Copy and run the command it outputs
```

### Step 7: Install Nginx (Reverse Proxy)

```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Step 8: Install Certbot (SSL Certificates)

```bash
# Install Certbot for Let's Encrypt SSL
sudo apt install -y certbot python3-certbot-nginx
```

---

## 🚢 Part 4: Deploy Your Application

### Step 9: Upload Application Files

**Option A: Using Git (Recommended)**

```bash
# Create app directory
mkdir -p ~/apps
cd ~/apps

# Clone your repository (replace with your repo URL)
git clone https://github.com/yourusername/cartel-appeals.git
cd cartel-appeals

# Or if using GitHub private repo
git clone https://<YOUR_GITHUB_TOKEN>@github.com/yourusername/cartel-appeals.git
```

**Option B: Using SCP (Secure Copy)**

From your local machine:
```bash
# Copy entire project to server
scp -i ~/Downloads/cartel-appeals-key.pem -r /path/to/your/project azureuser@YOUR_AZURE_IP:~/apps/cartel-appeals
```

### Step 10: Install Dependencies and Build

```bash
cd ~/apps/cartel-appeals

# Install dependencies
npm install

# Build the application
npm run build
```

### Step 11: Configure Environment Variables

```bash
# Create production .env file
nano .env
```

Add these variables (replace with your actual values):
```env
NODE_ENV=production
PORT=3000

# hCaptcha (or Cloudflare Turnstile)
HCAPTCHA_SECRET_KEY=your_hcaptcha_secret_key
VITE_HCAPTCHA_SITEKEY=your_hcaptcha_site_key

# Cloudflare Turnstile (optional, more secure)
CLOUDFLARE_TURNSTILE_SECRET=your_turnstile_secret
VITE_CLOUDFLARE_TURNSTILE_SITEKEY=your_turnstile_site_key

# Discord Webhook
DISCORD_WEBHOOK_URL=your_discord_webhook_url

# Security Admin Key (for unblocking IPs)
SECURITY_ADMIN_KEY=your_strong_random_key_here

# Database (if using PostgreSQL)
# DATABASE_URL=postgresql://user:password@localhost:5432/appeals
```

Save and exit: `Ctrl + X`, then `Y`, then `Enter`

### Step 12: Start Application with PM2

```bash
# Start the app with PM2
pm2 start npm --name "cartel-appeals" -- start

# Save PM2 configuration
pm2 save

# View logs
pm2 logs cartel-appeals

# Check status
pm2 status
```

---

## 🔐 Part 5: Configure Nginx & SSL

### Step 13: Configure Nginx Reverse Proxy

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/cartel-appeals
```

Paste this configuration (replace `yourdomain.com`):

```nginx
# Rate limiting zones - AGGRESSIVE
limit_req_zone $binary_remote_addr zone=general:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=appeals:10m rate=3r/h;

# Connection limit
limit_conn_zone $binary_remote_addr zone=addr:10m;

server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Client body size limit (prevent large uploads)
    client_max_body_size 10k;
    client_body_buffer_size 10k;

    # Timeouts
    client_body_timeout 10s;
    client_header_timeout 10s;
    keepalive_timeout 30s;
    send_timeout 10s;

    # Connection limits
    limit_conn addr 10;

    # Block common attack paths
    location ~ /\. {
        deny all;
        return 404;
    }

    location ~ \.(env|git|svn|htaccess)$ {
        deny all;
        return 404;
    }

    # API endpoints with strict rate limiting
    location /api/appeals {
        limit_req zone=appeals burst=1 nodelay;
        limit_req_status 429;
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 30s;
    }

    location /api {
        limit_req zone=api burst=5 nodelay;
        limit_req_status 429;
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files and frontend
    location / {
        limit_req zone=general burst=10 nodelay;
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Save and exit: `Ctrl + X`, then `Y`, then `Enter`

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/cartel-appeals /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 14: Setup SSL Certificate (HTTPS)

```bash
# Get SSL certificate from Let's Encrypt
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow the prompts:
# - Enter your email
# - Agree to terms
# - Choose to redirect HTTP to HTTPS (option 2)

# Auto-renewal test
sudo certbot renew --dry-run
```

The certificate will auto-renew. Certbot sets up a cron job automatically.

---

## 🛡️ Part 6: Additional Security Hardening

### Step 15: Configure Automated Security Updates

```bash
# Install unattended-upgrades
sudo apt install -y unattended-upgrades

# Enable automatic security updates
sudo dpkg-reconfigure -plow unattended-upgrades
# Select "Yes"
```

### Step 16: Setup Log Monitoring

```bash
# Install logwatch
sudo apt install -y logwatch

# Configure daily email reports (optional)
echo "/usr/sbin/logwatch --output mail --mailto your@email.com --detail high" | sudo tee -a /etc/cron.daily/00logwatch
sudo chmod +x /etc/cron.daily/00logwatch
```

### Step 17: Harden SSH (Disable Password Authentication)

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config
```

Find and modify these lines:
```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
X11Forwarding no
MaxAuthTries 3
```

Save and restart SSH:
```bash
sudo systemctl restart sshd
```

### Step 18: Install and Configure ModSecurity with Nginx

```bash
# Install ModSecurity
sudo apt install -y libnginx-mod-security

# Enable OWASP rules
sudo mv /etc/nginx/modsec/modsecurity.conf-recommended /etc/nginx/modsec/modsecurity.conf
sudo sed -i 's/SecRuleEngine DetectionOnly/SecRuleEngine On/' /etc/nginx/modsec/modsecurity.conf

# Download OWASP Core Rule Set
cd /etc/nginx/modsec
sudo git clone https://github.com/coreruleset/coreruleset.git
sudo mv coreruleset/crs-setup.conf.example coreruleset/crs-setup.conf

# Restart Nginx
sudo systemctl restart nginx
```

---

## 📊 Part 7: Monitoring & Maintenance

### Application Monitoring

```bash
# View application logs
pm2 logs cartel-appeals

# Monitor resources
pm2 monit

# Restart app if needed
pm2 restart cartel-appeals

# View blocked IPs (requires curl or browser)
curl http://localhost:3000/api/security/blocked-ips
```

### Nginx Monitoring

```bash
# View Nginx access logs
sudo tail -f /var/log/nginx/access.log

# View Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check Nginx status
sudo systemctl status nginx
```

### System Monitoring

```bash
# Check disk usage
df -h

# Check memory usage
free -h

# Check CPU usage
top

# Check active connections
sudo netstat -tuln

# View fail2ban status
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

---

## 🔄 Part 8: Application Updates

### Deploying Updates

```bash
# Navigate to app directory
cd ~/apps/cartel-appeals

# Pull latest changes
git pull origin main

# Install new dependencies (if any)
npm install

# Rebuild application
npm run build

# Restart with zero downtime
pm2 reload cartel-appeals
```

---

## 🆘 Troubleshooting

### Application Won't Start
```bash
# Check PM2 logs
pm2 logs cartel-appeals

# Check if port 3000 is in use
sudo lsof -i :3000

# Restart the application
pm2 restart cartel-appeals
```

### Nginx Issues
```bash
# Test Nginx configuration
sudo nginx -t

# Check Nginx status
sudo systemctl status nginx

# Restart Nginx
sudo systemctl restart nginx
```

### SSL Certificate Issues
```bash
# Renew SSL manually
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

### High CPU/Memory Usage
```bash
# Check processes
top
htop  # Install with: sudo apt install htop

# Restart application
pm2 restart cartel-appeals

# Clear logs
pm2 flush
```

---

## 🔐 Security Checklist

Before going live, verify:

- ✅ Firewall (UFW) is enabled and configured
- ✅ Fail2Ban is running
- ✅ SSH password authentication is disabled
- ✅ SSL certificate is installed and auto-renewing
- ✅ Nginx rate limiting is configured
- ✅ ModSecurity is enabled
- ✅ Environment variables are set correctly
- ✅ Cloudflare proxy is enabled (orange cloud)
- ✅ All Cloudflare security features are configured
- ✅ Application security layers are active (18 layers)
- ✅ Automatic security updates are enabled

---

## 📝 Important Notes

1. **Backup Strategy:**
   ```bash
   # Backup application files
   tar -czf ~/backup-$(date +%Y%m%d).tar.gz ~/apps/cartel-appeals
   
   # Download backup to local machine
   scp azureuser@YOUR_IP:~/backup-*.tar.gz ~/Downloads/
   ```

2. **Monitor Blocked IPs:**
   - Check `/api/security/blocked-ips` regularly
   - Unblock legitimate users if needed:
   ```bash
   curl -X POST http://localhost:3000/api/security/unblock \
     -H "Content-Type: application/json" \
     -d '{"ip":"1.2.3.4","adminKey":"YOUR_SECURITY_ADMIN_KEY"}'
   ```

3. **Scale Up If Needed:**
   - Upgrade Azure VM size if traffic increases
   - Consider Azure Load Balancer for multiple instances
   - Use Azure CDN for static assets

4. **Cost Optimization:**
   - Standard_B2s: ~$30-40/month
   - Standard_B2ms: ~$60-80/month
   - Set up budget alerts in Azure Portal

---

## 🎯 Quick Commands Reference

```bash
# Application Management
pm2 status                    # View app status
pm2 restart cartel-appeals    # Restart app
pm2 logs cartel-appeals       # View logs
pm2 monit                     # Monitor resources

# Nginx Management
sudo nginx -t                 # Test config
sudo systemctl restart nginx  # Restart Nginx
sudo tail -f /var/log/nginx/access.log  # View access logs

# Security
sudo ufw status               # Firewall status
sudo fail2ban-client status   # Fail2Ban status
curl localhost:3000/api/security/blocked-ips  # View blocked IPs

# System
df -h                         # Disk usage
free -h                       # Memory usage
top                           # CPU usage
```

---

## 🚀 You're All Set!

Your application is now running on Azure with:
- ✅ Military-grade security (18 layers)
- ✅ DDoS protection via Cloudflare + Application
- ✅ SSL/HTTPS encryption
- ✅ Automated security updates
- ✅ Professional monitoring
- ✅ Zero-downtime deployments

Access your site at: `https://yourdomain.com`

**Need help? Check logs:**
- Application: `pm2 logs cartel-appeals`
- Nginx: `sudo tail -f /var/log/nginx/error.log`
- System: `sudo tail -f /var/log/syslog`
