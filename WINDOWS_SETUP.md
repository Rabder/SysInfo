# Windows 11 Setup Guide

## Prerequisites
1. **Node.js** - Download from https://nodejs.org/ (LTS version recommended)
2. **Groq API Key** - Free from https://console.groq.com/keys

## Setup Steps

### 1. Transfer Files to Windows
Copy all these files to a folder on your Windows 11 machine:
- `package.json`
- `main.js` 
- `llm-agent.js`
- `preload.js`
- `index.html`
- `context.txt`
- `.env.example`

### 2. Install Dependencies
Open **PowerShell** or **Command Prompt** in the project folder:
```bash
npm install
```

### 3. Configure API Key
1. Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```
2. Edit `.env` file and add your Groq API key:
   ```
   GROQ_API_KEY=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
   ```

### 4. Run the Application
```bash
npm start
```

## Testing on Windows 11

The app is specifically designed for Windows PowerShell commands. Try these queries:
- **"how many cores do I have?"**
- **"how much RAM?"** 
- **"what processes are using the most memory?"**
- **"what's my graphics card?"**
- **"show me disk space"**
- **"what's my CPU usage?"**
- **"list running services"**

## Windows 11 Specific Features

The app will use PowerShell commands like:
- `Get-WmiObject -Class Win32_Processor` for CPU info
- `Get-Process | Sort-Object WorkingSet -Descending` for memory usage
- `Get-WmiObject Win32_VideoController` for GPU info
- `Get-WmiObject -Class Win32_PhysicalMemory` for RAM details

## Troubleshooting

**If you get "GROQ_API_KEY not found":**
- Make sure `.env` file exists (not `.env.example`)
- Check that your API key is correctly set in `.env`
- Restart the application after changing `.env`

**If PowerShell commands fail:**
- Make sure you're running on Windows 11
- Check PowerShell execution policy: `Get-ExecutionPolicy`
- If restricted, run as Administrator: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

**If Electron app won't start:**
- Make sure Node.js is properly installed
- Try: `npm install electron --save-dev`
- Run: `npm run dev` instead of `npm start`

## Performance Notes
- First startup may take a few seconds to initialize Groq connection
- Subsequent queries will be very fast (Groq is optimized for speed)
- The app works best on Windows where PowerShell commands return real system data