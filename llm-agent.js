const axios = require('axios');
const { execSync, spawn } = require('child_process');
const si = require('systeminformation');
const path = require('path');
const fs = require('fs');

class SystemAgent {
  constructor() {
    this.ollamaUrl = 'http://localhost:11434';
    this.model = 'gemma2:2b';
    this.ollamaProcess = null;
    this.isInitialized = false;
    
    this.fallbackMethods = {
      'cores': () => require('os').cpus().length,
      'cpu': () => require('os').cpus()[0].model,
      'platform': () => require('os').platform(),
      'memory': () => Math.round(require('os').totalmem() / (1024**3)) + ' GB',
      'freemem': () => Math.round(require('os').freemem() / (1024**3)) + ' GB',
      'uptime': () => Math.round(require('os').uptime() / 3600) + ' hours',
      'hostname': () => require('os').hostname(),
      'arch': () => require('os').arch()
    };

    this.advancedMethods = {
  'cpu': async () => {
    const cpu = await si.cpu();
    return {
      manufacturer: cpu.manufacturer,
      brand: cpu.brand,
      speed: cpu.speed,
      cores: cpu.cores,
      physicalCores: cpu.physicalCores
    };
  },
  'memory': async () => {
    const mem = await si.mem();
    return {
      total: `${(mem.total / (1024 ** 3)).toFixed(2)} GB`,
      free: `${(mem.free / (1024 ** 3)).toFixed(2)} GB`,
      used: `${(mem.used / (1024 ** 3)).toFixed(2)} GB`
    };
  },
  'disk': async () => {
    const disks = await si.diskLayout();
    return disks.map(disk => ({
      type: disk.type,
      name: disk.name,
      size: `${(disk.size / (1024 ** 3)).toFixed(2)} GB`,
      interfaceType: disk.interfaceType
    }));
  },
  'storage': async () => {
    const fsSize = await si.fsSize();
    return fsSize.map(fs => ({
      mount: fs.mount,
      size: `${(fs.size / (1024 ** 3)).toFixed(2)} GB`,
      used: `${(fs.used / (1024 ** 3)).toFixed(2)} GB`,
      available: `${(fs.available / (1024 ** 3)).toFixed(2)} GB`
    }));
  },
  'network': async () => {
    const network = await si.networkInterfaces();
    return network.filter(n => n.operstate === 'up').map(n => ({
      interface: n.iface,
      ip4: n.ip4,
      ip6: n.ip6,
      mac: n.mac,
      speed: n.speed
    }));
  },
  'battery': async () => {
    const battery = await si.battery();
    return {
      hasBattery: battery.hasBattery,
      isCharging: battery.isCharging,
      level: `${battery.percent}%`,
      timeRemaining: battery.timeRemaining ? `${battery.timeRemaining} minutes` : 'unknown'
    };
  },
  'os': async () => {
    const os = await si.osInfo();
    return {
      platform: os.platform,
      distro: os.distro,
      release: os.release,
      arch: os.arch,
      uptime: `${Math.floor(os.uptime / 3600)} hours`
    };
  },
  'graphics': async () => {
    const graphics = await si.graphics();
    return graphics.controllers.map(g => ({
      model: g.model,
      vendor: g.vendor,
      vram: g.vram ? `${Math.round(g.vram)} MB` : 'unknown'
    }));
  },
  'processes': async () => {
    const processes = await si.processes();
    return {
      total: processes.all,
      running: processes.running,
      blocked: processes.blocked,
      sleeping: processes.sleeping
    };
  }
};
}

  async initialize() {
    if (this.isInitialized) return true;
    
    console.log('🚀 Initializing System Agent...');
    
    try {
      // Check if Ollama is installed
      await this.ensureOllamaInstalled();
      
      // Start Ollama service
      await this.startOllamaService();
      
      // Ensure model is available
      await this.ensureModelAvailable();
      
      this.isInitialized = true;
      console.log('✅ System Agent initialized successfully!');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize System Agent:', error.message);
      return false;
    }
  }

  async ensureOllamaInstalled() {
    try {
      execSync('ollama --version', { stdio: 'ignore' });
      console.log('✅ Ollama is installed');
    } catch (error) {
      console.log('📥 Ollama not found, attempting to install...');
      throw new Error('Ollama not installed. Please install Ollama first from https://ollama.ai');
    }
  }

  async startOllamaService() {
    try {
      // Check if already running
      await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 2000 });
      console.log('✅ Ollama service is already running');
      return;
    } catch (error) {
      // Not running, start it
      console.log('🔄 Starting Ollama service...');
      
      this.ollamaProcess = spawn('ollama', ['serve'], {
        detached: true,
        stdio: 'ignore'
      });
      
      // Wait for service to be ready
      for (let i = 0; i < 30; i++) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 2000 });
          console.log('✅ Ollama service started successfully');
          return;
        } catch (err) {
          // Still starting up
        }
      }
      
      throw new Error('Ollama service failed to start within 30 seconds');
    }
  }

  async ensureModelAvailable() {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`);
      const models = response.data.models || [];
      
      const modelExists = models.some(model => 
        model.name === this.model || 
        model.name === 'gemma2:2b' || 
        model.name === 'gemma2' ||
        model.name === 'gemma3'
      );
      
      if (modelExists) {
        console.log('✅ Model is available');
        return;
      }
      
      console.log(`📥 Downloading model ${this.model}... This may take a few minutes.`);
      
      return new Promise((resolve, reject) => {
        const pullProcess = spawn('ollama', ['pull', this.model], {
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        pullProcess.stdout.on('data', (data) => {
          console.log(`📥 ${data.toString().trim()}`);
        });
        
        pullProcess.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Model downloaded successfully');
            resolve();
          } else {
            reject(new Error(`Failed to download model. Exit code: ${code}`));
          }
        });
        
        setTimeout(() => {
          pullProcess.kill();
          reject(new Error('Model download timeout (10 minutes)'));
        }, 600000);
      });
      
    } catch (error) {
      throw new Error(`Failed to setup model: ${error.message}`);
    }
  }

  async cleanup() {
    if (this.ollamaProcess) {
      console.log('🧹 Cleaning up Ollama process...');
      this.ollamaProcess.kill();
    }
  }

async queryLLM(userQuery, previousError = null, failedCommand = null) {
  let systemPrompt = `You are an expert Windows system administrator. Generate the most appropriate PowerShell commands to answer user questions about their system.`;
  try {
    const contextPath = path.join(__dirname, 'context.txt');
    if (fs.existsSync(contextPath)) {
      const contextData = fs.readFileSync(contextPath, 'utf-8').trim();
      if (contextData) {
        systemPrompt = `# Additional context:\n${contextData}\n\n` + systemPrompt;
      }
    }
  } catch (contextError) {
    console.warn("⚠️ Could not load context.txt:", contextError.message);
  }

  if (previousError) {
    systemPrompt += `\n\nPrevious attempt failed with error: ${previousError}\nPrevious command: ${failedCommand}\nPlease generate a better command that avoids this error.`;
  }

  systemPrompt += `\n\nNow answer: "${userQuery}"`;

  try {
    const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
      model: this.model,
      prompt: systemPrompt,
      stream: false,
      options: {
        temperature: previousError ? 0.3 : 0.1,
        top_p: 0.9,
        max_tokens: 300
      }
    });

    return response.data.response.trim();
  } catch (error) {
    throw new Error(`LLM request failed: ${error.message}`);
  }
}

  validateCommand(command) {
    return true;
  }

  async tryAdvancedMethod(userQuery) {
    const query = userQuery.toLowerCase();
    
    for (const [key, method] of Object.entries(this.advancedMethods)) {
      if (query.includes(key)) {
        try {
          console.log(`🔬 Trying advanced method: ${key}`);
          const result = await method();
          return `🔬 Advanced system info:\n${JSON.stringify(result, null, 2)}`;
        } catch (error) {
          console.log(`Advanced method failed for ${key}:`, error.message);
        }
      }
    }
    
    return null;
  }

  tryFallbackMethod(userQuery) {
    const query = userQuery.toLowerCase();
    
    for (const [key, method] of Object.entries(this.fallbackMethods)) {
      if (query.includes(key)) {
        try {
          const result = method();
          return `📋 Using built-in method: ${result}`;
        } catch (error) {
          console.log(`Fallback method failed for ${key}:`, error.message);
        }
      }
    }
    
    return null;
  }

  async executeCommand(command) {
  try {
    // Modify command to convert output to JSON for better parsing
    const jsonCommand = `${command} | ConvertTo-Json -Depth 10`;
    const result = execSync(`powershell -Command "${jsonCommand}"`, { 
      encoding: 'utf8', 
      timeout: 10000,
      maxBuffer: 1024 * 1024 * 5 // 5MB buffer
    });
    
    try {
      // Try to parse JSON and format nicely
      const parsed = JSON.parse(result);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // If not JSON, return raw output
      return result.trim();
    }
  } catch (error) {
    throw new Error(`Command execution failed: ${error.message}`);
  }
}

async interpretResult(userQuery, command, rawOutput) {
  if (!rawOutput || rawOutput.trim() === '{}' || rawOutput.trim() === '[]') {
    return `I couldn't find any information about "${userQuery}". The command didn't return any data.`;
  }

  const prompt = `The user asked: "${userQuery}"
The following PowerShell command was executed:
${command}

It produced this output:
${rawOutput}

Please explain this technical system information in simple, non-technical terms that a regular user would understand. Focus on answering the user's original question directly first, then provide additional relevant details if available. Keep the response concise but helpful.`;

  try {
    const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
      model: this.model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.2,
        max_tokens: 300 // Allow for more detailed explanations
      }
    });
    
    // Clean up the response
    let interpretation = response.data.response.trim();
    interpretation = interpretation.replace(/^\s*"/, '').replace(/"\s*$/, ''); // Remove surrounding quotes if present
    return interpretation;
  } catch (error) {
    console.error('Interpretation failed:', error);
    // Provide a fallback interpretation
    return `Here's the technical information about your system:\n${rawOutput}\n\nI couldn't generate a simplified explanation.`;
  }
}
async processQuery(userQuery, maxRetries = 2) {
  if (!this.isInitialized) {
    const initialized = await this.initialize();
    if (!initialized) {
      return {
        interpretation: "System initialization failed. Using basic methods only.",
        command: "",
        rawOutput: ""
      };
    }
  }

  // First try advanced methods if they match the query
  const queryLower = userQuery.toLowerCase();
  const advancedMatch = Object.keys(this.advancedMethods).find(key => 
    queryLower.includes(key)
  );
  
  if (advancedMatch) {
    try {
      const advancedResult = await this.tryAdvancedMethod(userQuery);
      if (advancedResult) {
        const interpretation = await this.interpretResult(
          userQuery, 
          "Used systeminformation package", 
          JSON.stringify(advancedResult, null, 2)
        );
        return {
          interpretation: interpretation,
          command: "Used systeminformation package",
          rawOutput: JSON.stringify(advancedResult, null, 2)
        };
      }
    } catch (error) {
      console.log(`Advanced method failed:`, error);
    }
  }

  // If no advanced method or it failed, try LLM-generated command
  let lastError = null;
  let lastCommand = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const llmCommand = await this.queryLLM(userQuery, lastError, lastCommand);
      
      if (!llmCommand || llmCommand.toLowerCase().includes("i don't know")) {
        const fallbackResult = this.tryFallbackMethod(userQuery);
        if (fallbackResult) {
          return {
            interpretation: fallbackResult,
            command: "Used built-in method",
            rawOutput: ""
          };
        }
        return {
          interpretation: `I couldn't find a way to answer "${userQuery}". Try asking about specific system components like CPU, memory, disk, etc.`,
          command: "",
          rawOutput: ""
        };
      }

      const rawResult = await this.executeCommand(llmCommand);
      const interpretation = await this.interpretResult(userQuery, llmCommand, rawResult);
      
      return {
        interpretation: interpretation,
        command: llmCommand,
        rawOutput: rawResult
      };

    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      lastError = error.message;
      
      if (attempt === maxRetries) {
        // Final fallback
        const fallbackResult = this.tryFallbackMethod(userQuery);
        if (fallbackResult) {
          return {
            interpretation: `⚡ After several attempts, I found another way!\n\n${fallbackResult}`,
            command: "Used fallback method",
            rawOutput: ""
          };
        }
        
        return {
          interpretation: `I couldn't retrieve the information for "${userQuery}".\n\nLast error: ${error.message}\n\nTry asking differently or about a specific component.`,
          command: lastCommand || "",
          rawOutput: ""
        };
      }
    }
  }
}
}
  

module.exports = SystemAgent;