# Running CARTEL on Ubuntu

## Prerequisites

1. **Install Node.js and npm**
   ```bash
   # Update package list
   sudo apt update
   
   # Install Node.js (v20 or higher recommended)
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   
   # Verify installation
   node --version
   npm --version
   ```

## Setup Steps

1. **Download/Clone the Project**
   - If on Replit: Download your project as a zip file and extract it
   - Or clone via git if you have it in a repository

2. **Navigate to Project Directory**
   ```bash
   cd /path/to/your/cartel-project
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Run the Development Server**
   ```bash
   # Port 80 requires root privileges on Ubuntu
   sudo npm run dev
   ```

5. **Access the Application**
   - Open your browser and go to: `http://localhost`
   - The app should be running with the terminal theme and all features!
   
   **Note**: Port 80 requires sudo/root privileges on Ubuntu. If you prefer not to use sudo, you can set a custom port:
   ```bash
   PORT=3000 npm run dev
   ```
   Then access at `http://localhost:3000`

## Troubleshooting

- **Permission denied on port 80**: Port 80 requires root privileges. Run with `sudo npm run dev`
- **Port already in use**: Change the port with `PORT=3000 npm run dev`
- **Module not found**: Make sure you ran `npm install` successfully

## Production Build

To create a production build:

```bash
# Build the frontend and backend
npm run build

# Run the production server
npm start
```

## Notes

- This is a single-page application with an Express backend
- All data is stored in memory (no database setup needed)
- The app runs on port 80 by default (requires sudo on Ubuntu)
- You can use a different port by setting the PORT environment variable: `PORT=3000 npm run dev`
