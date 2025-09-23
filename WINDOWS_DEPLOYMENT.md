# Windows Deployment Guide

This guide helps you run the Conference Voice Assistant on Windows environments.

## Prerequisites

- Windows 10/11 or Windows Server 2016+
- PowerShell 5.1 or later (or PowerShell Core 7+)
- Git for Windows
- Node.js 18+ (LTS recommended)

## Quick Setup

### Option 1: PowerShell Script (Recommended)

Run the automated setup script:

```powershell
# Download and run the setup script
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/your-repo/conference-voice-assistant/main/scripts/setup-windows.ps1" -OutFile "setup-windows.ps1"
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\setup-windows.ps1
```

### Option 2: Manual Setup

1. **Clone the repository:**
   ```powershell
   git clone https://github.com/your-repo/conference-voice-assistant.git
   cd conference-voice-assistant
   ```

2. **Install dependencies:**
   ```powershell
   npm install
   ```

3. **Set up environment variables:**
   ```powershell
   Copy-Item .env.example .env
   # Edit .env file with your API keys
   ```

4. **Initialize the database:**
   ```powershell
   npm run setup
   ```

5. **Start the server:**
   ```powershell
   npm start
   ```

## Environment Configuration

### Required Environment Variables

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=3000
NODE_ENV=production
WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-realtime-preview-2024-10-01

# Infobip Configuration
INFOBIP_API_KEY=your_infobip_api_key
INFOBIP_BASE_URL=your_infobip_base_url
INFOBIP_APP_ID=your_infobip_app_id

# Database Configuration (SQLite)
DATABASE_PATH=data\conference.db
```

### Windows-Specific Notes

1. **File Paths**: Use backslashes (`\`) for local paths in Windows
2. **PowerShell Execution Policy**: May need to run `Set-ExecutionPolicy RemoteSigned`
3. **Firewall**: Windows Firewall may prompt to allow Node.js network access
4. **Antivirus**: Some antivirus software may flag Node.js - add exclusions if needed

## Deployment Options

### Local Development

Perfect for testing and development:

```powershell
# Install dependencies
npm install

# Start in development mode
npm run dev
```

### Production Server

For production deployment on Windows Server:

1. **Use PM2 for process management:**
   ```powershell
   npm install -g pm2
   pm2 start npm --name "conference-assistant" -- start
   pm2 startup
   pm2 save
   ```

2. **Configure as Windows Service:**
   ```powershell
   # Install pm2-windows-service
   npm install -g pm2-windows-service
   pm2-service-install
   ```

### Cloud Deployment

#### Azure App Service

1. **Deploy using Azure CLI:**
   ```powershell
   az webapp create --resource-group myResourceGroup --plan myAppServicePlan --name conference-voice-assistant --runtime "NODE|18-lts"
   az webapp deployment source config-zip --resource-group myResourceGroup --name conference-voice-assistant --src conference-voice-assistant.zip
   ```

2. **Configure environment variables in Azure portal**

#### AWS EC2 (Windows)

1. Launch Windows Server EC2 instance
2. Install Node.js and Git
3. Clone repository and follow manual setup
4. Configure security groups for port 3000

## ngrok Setup for Windows

For webhook testing, use ngrok to create secure tunnels:

1. **Download ngrok:**
   ```powershell
   # Download from https://ngrok.com/download
   # Or use Chocolatey
   choco install ngrok
   ```

2. **Authenticate ngrok:**
   ```powershell
   ngrok config add-authtoken your_ngrok_auth_token
   ```

3. **Start tunnel:**
   ```powershell
   ngrok http 3000
   ```

4. **Update your .env file with the ngrok URL:**
   ```env
   WEBHOOK_BASE_URL=https://abc123.ngrok.io
   ```

## Database Considerations

### SQLite on Windows

- SQLite works perfectly on Windows
- Database file stored at `data\conference.db`
- No additional database server needed
- Automatic backups to `data\backups\`

### Alternative Database Options

If you need a full database server:

#### SQL Server Express (Free)

```powershell
# Install SQL Server Express
choco install sql-server-express

# Update database configuration
# Change DATABASE_URL in .env to use SQL Server connection string
```

#### PostgreSQL

```powershell
# Install PostgreSQL
choco install postgresql

# Create database and update .env
```

## Troubleshooting

### Common Issues

1. **Port 3000 already in use:**
   ```powershell
   netstat -ano | findstr :3000
   taskkill /PID <process-id> /F
   ```

2. **NPM install fails:**
   ```powershell
   # Clear npm cache
   npm cache clean --force
   
   # Try with --legacy-peer-deps
   npm install --legacy-peer-deps
   ```

3. **PowerShell execution policy:**
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

4. **Windows Firewall blocking:**
   - Allow Node.js through Windows Firewall
   - Or temporarily disable for testing

### Performance Optimization

1. **Windows Defender exclusions:**
   ```powershell
   Add-MpPreference -ExclusionPath "C:\path\to\conference-voice-assistant"
   ```

2. **Increase Node.js memory limit:**
   ```powershell
   $env:NODE_OPTIONS="--max-old-space-size=4096"
   npm start
   ```

## Testing on Windows

Run the test suite:

```powershell
# Test database setup
npm run test:db

# Test API endpoints
npm run test:api

# Test context management
npm run test:context

# Full test suite
npm test
```

## Monitoring and Logging

### Windows Event Log

Configure application to log to Windows Event Log:

```javascript
// Add to your app.js
const EventLog = require('node-windows').EventLog;
const log = new EventLog('Conference Voice Assistant');
```

### Performance Counters

Monitor with PowerShell:

```powershell
# Monitor Node.js process
Get-Counter "\Process(node)\% Processor Time"
Get-Counter "\Process(node)\Working Set"
```

## Security Considerations

1. **Windows Updates**: Keep system updated
2. **API Keys**: Store securely, never commit to repository
3. **Firewall**: Only open necessary ports
4. **User Permissions**: Run with minimum required privileges
5. **HTTPS**: Always use SSL/TLS in production

## Support

For Windows-specific issues:

1. Check the GitHub Issues page
2. Review Windows-specific logs in Event Viewer
3. Test with PowerShell ISE for debugging
4. Consider using WSL2 for Linux-like experience

## Migration from Mac/Linux

### File Path Differences

- Change `/` to `\` in local file paths
- Update `package.json` scripts for Windows commands
- Environment variables use `%VAR%` instead of `$VAR`

### Command Differences

| Mac/Linux | Windows PowerShell |
|-----------|-------------------|
| `ls` | `dir` or `Get-ChildItem` |
| `grep` | `Select-String` |
| `curl` | `Invoke-WebRequest` |
| `tail -f` | `Get-Content -Wait` |

### Example Migration

```powershell
# Original Mac command
# tail -f logs/app.log | grep ERROR

# Windows equivalent
Get-Content -Wait logs\app.log | Select-String "ERROR"
```

This guide provides comprehensive coverage for deploying and running the Conference Voice Assistant on Windows systems, from development to production environments.