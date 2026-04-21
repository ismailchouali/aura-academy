#!/usr/bin/env node
/**
 * Aura Academy - Robust Keepalive Script
 * Runs forever, checks server every 15 seconds, restarts if dead.
 * Usage: node keepalive.js &
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const CHECK_INTERVAL = 15000; // 15 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;
const PROJECT_DIR = '/home/z/my-project';
const LOG_FILE = '/tmp/aura-keepalive.log';
const SERVER_LOG = '/tmp/standalone.log';

let serverProcess = null;
let isRestarting = false;

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

function isServerAlive() {
  try {
    const result = execSync(`curl -s -m 3 http://127.0.0.1:${PORT}/api/dashboard -o /dev/null -w '%{http_code}'`, {
      timeout: 5000,
      encoding: 'utf8'
    });
    return result.trim() === '200';
  } catch {
    return false;
  }
}

function isPortListening() {
  try {
    const result = execSync(`ss -tlnp | grep ${PORT}`, {
      timeout: 3000,
      encoding: 'utf8'
    });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

function killStale() {
  try {
    execSync("pkill -f 'server.js' 2>/dev/null; pkill -f 'next-server' 2>/dev/null", {
      timeout: 5000,
      encoding: 'utf8'
    });
  } catch {}
}

function copyStaticFiles() {
  try {
    execSync('cp -r .next/static .next/standalone/.next/static 2>/dev/null; cp -r public .next/standalone/public 2>/dev/null', {
      cwd: PROJECT_DIR,
      timeout: 10000,
      encoding: 'utf8'
    });
  } catch {}
}

function startServer() {
  return new Promise((resolve) => {
    killStale();

    // Temporarily move .config if it's a file (JuiceFS meta)
    const configPath = path.join(PROJECT_DIR, '.config');
    const configBackup = path.join(PROJECT_DIR, '.config-bak-keepalive');
    let movedConfig = false;
    try {
      if (fs.existsSync(configPath) && fs.statSync(configPath).isFile()) {
        fs.renameSync(configPath, configBackup);
        movedConfig = true;
      }
    } catch {}

    copyStaticFiles();

    const logStream = fs.openSync(SERVER_LOG, 'a');

    serverProcess = spawn('node', ['.next/standalone/server.js'], {
      cwd: PROJECT_DIR,
      env: { ...process.env, PORT: String(PORT) },
      detached: false,
      stdio: ['ignore', logStream, logStream],
    });

    // Restore .config immediately
    if (movedConfig) {
      try { fs.renameSync(configBackup, configPath); } catch {}
    }

    serverProcess.on('error', (err) => {
      log(`Server spawn error: ${err.message}`);
      resolve(false);
    });

    serverProcess.on('exit', (code, signal) => {
      log(`Server exited: code=${code}, signal=${signal}`);
      serverProcess = null;
      resolve(false);
    });

    // Wait and check
    setTimeout(() => {
      if (isServerAlive()) {
        log(`Server started successfully (PID: ${serverProcess ? serverProcess.pid : 'unknown'})`);
        resolve(true);
      } else if (serverProcess) {
        log('Server process running but not responding yet...');
        resolve(true); // Give it more time
      } else {
        log('Server failed to start');
        resolve(false);
      }
    }, 8000);
  });
}

async function checkAndRestart() {
  if (isRestarting) return;

  const portAlive = isPortListening();
  const serverAlive = isServerAlive();

  if (!portAlive || !serverAlive) {
    log(`ALERT: Server ${!portAlive ? 'port not listening' : 'not responding'} - restarting...`);
    isRestarting = true;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      log(`Restart attempt ${attempt}/${MAX_RETRIES}`);
      const started = await startServer();

      if (started) {
        // Double-check after a few more seconds
        await new Promise(r => setTimeout(r, 5000));
        if (isServerAlive()) {
          log('Server verified and healthy');
          isRestarting = false;
          return;
        }
      }

      if (attempt < MAX_RETRIES) {
        log(`Attempt ${attempt} failed, waiting ${RETRY_DELAY}ms...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY));
      }
    }

    log(`CRITICAL: Failed to start server after ${MAX_RETRIES} attempts`);
    isRestarting = false;
  }
}

// Main loop
async function main() {
  log('=== Aura Academy Keepalive Starting ===');
  log(`Check interval: ${CHECK_INTERVAL}ms, Port: ${PORT}`);

  // Initial start
  if (!isServerAlive()) {
    log('Server not running on startup, starting...');
    await checkAndRestart();
  } else {
    log('Server already running');
  }

  // Periodic check
  setInterval(async () => {
    try {
      await checkAndRestart();
    } catch (err) {
      log(`Check error: ${err.message}`);
    }
  }, CHECK_INTERVAL);

  log('Keepalive loop active');
}

// Handle process signals
process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down keepalive');
  if (serverProcess) serverProcess.kill();
  process.exit(0);
});

process.on('SIGINT', () => {
  log('Received SIGINT, shutting down keepalive');
  if (serverProcess) serverProcess.kill();
  process.exit(0);
});

// Prevent crash
process.on('uncaughtException', (err) => {
  log(`Uncaught exception: ${err.message}`);
});

process.on('unhandledRejection', (err) => {
  log(`Unhandled rejection: ${err}`);
});

main().catch(err => {
  log(`Fatal: ${err.message}`);
  process.exit(1);
});
