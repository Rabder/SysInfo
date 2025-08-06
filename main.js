const { app, BrowserWindow, ipcMain } = require('electron');
const { execSync } = require('child_process');
const path = require('path');

let mainWindow;
let agent;

async function initializeAgent() {
  try {
    console.log('🚀 Starting System Agent initialization...');
    
    const SystemAgent = require('./llm-agent');
    agent = new SystemAgent();
    
    // Show window immediately with loading state
    mainWindow.show();
    mainWindow.webContents.send('initialization-status', 'Initializing AI system...');
    
    // Initialize in background
    const success = await agent.initialize();
    
    if (success) {
      mainWindow.webContents.send('initialization-status', 'Ready! Ask me about your system...');
    } else {
      mainWindow.webContents.send('initialization-status', 'AI setup failed, using basic mode...');
    }
    
    return success;
  } catch (error) {
    console.error('Initialization error:', error);
    mainWindow.webContents.send('initialization-status', 'Error during setup, using basic mode...');
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 400,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    resizable: false,
    maximizable: false,
    show: false
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);
  
  // Initialize the agent
  initializeAgent();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (agent && agent.cleanup) {
    agent.cleanup();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('query-system', async (event, query) => {
  try {
    if (!agent) {
      return {
        interpretation: 'System still initializing, please wait...',
        command: '',
        rawOutput: ''
      };
    }
    
    const result = await agent.processQuery(query);
    return result;
  } catch (error) {
    return {
      interpretation: `Error: ${error.message}`,
      command: '',
      rawOutput: ''
    };
  }
});