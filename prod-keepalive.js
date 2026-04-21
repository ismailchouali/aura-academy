const { spawn, execSync } = require('child_process');
const fs = require('fs');

const STARTUP_CMD = 'node .next/standalone/server.js';
const CHECK_INTERVAL = 15000; // check every 15s
const RETRY_DELAY = 3000;

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  fs.appendFileSync('/tmp/prod_server.log', line);
  process.stdout.write(line);
}

function isListening() {
  try {
    const result = execSync('ss -tlnp | grep :3000', { encoding: 'utf8', timeout: 3000 });
    return result && result.includes('3000');
  } catch {
    return false;
  }
}

function doPing() {
  try {
    execSync('curl -s -m 5 http://127.0.0.1:3000/api/notifications/unread-count', { encoding: 'utf8', timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

let serverProcess = null;

function start() {
  // Kill any leftover processes on port 3000
  try { execSync('fuser -k 3000/tcp 2>/dev/null', { timeout: 3000 }); } catch {}
  try { execSync('pkill -f "standalone/server.js" 2>/dev/null', { timeout: 3000 }); } catch {}

  log(`Starting: ${STARTUP_CMD}`);
  serverProcess = spawn('node', ['.next/standalone/server.js'], {
    cwd: '/home/z/my-project',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production', PORT: '3000' },
    detached: false,
  });

  serverProcess.stdout.on('data', d => log(d.toString().trim()));
  serverProcess.stderr.on('data', d => log(d.toString().trim()));
  serverProcess.on('exit', (code) => {
    log(`Server exited with code ${code}, restarting in ${RETRY_DELAY}ms...`);
    setTimeout(start, RETRY_DELAY);
  });
  serverProcess.on('error', (err) => {
    log(`Server error: ${err.message}, restarting in ${RETRY_DELAY}ms...`);
    setTimeout(start, RETRY_DELAY);
  });
}

// Periodic health check with actual HTTP request
setInterval(() => {
  if (!isListening()) {
    log('Health check: port 3000 not listening, forcing restart...');
    if (serverProcess) {
      try { serverProcess.kill(); } catch {}
    }
    setTimeout(start, 1000);
    return;
  }

  // Even if port is listening, verify the server responds
  if (!doPing()) {
    log('Health check: server not responding to HTTP, forcing restart...');
    if (serverProcess) {
      try { serverProcess.kill(); } catch {}
    }
    setTimeout(start, 1000);
    return;
  }
}, CHECK_INTERVAL);

// Keep process alive by preventing it from being considered idle
setInterval(() => {
  // Touch a file to keep I/O active
  try {
    fs.writeFileSync('/tmp/keepalive-active', new Date().toISOString());
  } catch {}
}, 5000);

log('Keepalive started - will monitor and auto-restart every 15s');
start();
