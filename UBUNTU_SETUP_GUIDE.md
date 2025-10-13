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
   npm run dev
   ```

5. **Access the Application**
   - Open your browser and go to: `http://localhost:5000`
   - The app should be running with the terminal theme and all features!

## Troubleshooting

- **Port already in use**: If port 5000 is taken, you can change it in `server/index.ts`
- **Permission errors**: Run with `sudo` if needed (though usually not required)
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
- The app runs on port 5000 by default
