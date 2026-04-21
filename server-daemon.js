const { spawn, execSync } = require('child_process');
const fs = require('fs');
const http = require('http');

const PID_FILE = '/home/z/my-project/server.pid';
const LOG_FILE = '/home/z/my-project/server.log';

// Prevent duplicate instances
try {
  const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf8'));
  if (oldPid && oldPid > 0) {
    try { process.kill(oldPid, 0); process.exit(0); } catch(e) {}
  }
} catch(e) {}

fs.writeFileSync(PID_FILE, String(process.pid));
process.on('exit', () => { try { fs.unlinkSync(PID_FILE); } catch(e) {} });

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['node_modules/.bin/next', 'dev', '-p', '3000'], {
      cwd: '/home/z/my-project',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'development' }
    });

    child.stdout.on('data', d => {
      const msg = d.toString();
      fs.appendFileSync(LOG_FILE, `[stdout] ${msg}`);
      if (msg.includes('Ready in')) {
        setTimeout(resolve, 500);
      }
    });
    child.stderr.on('data', d => {
      fs.appendFileSync(LOG_FILE, `[stderr] ${d.toString()}`);
    });
    child.on('exit', (code) => {
      fs.appendFileSync(LOG_FILE, `[exit] Server exited with code ${code}. Restarting in 3s...\n`);
      setTimeout(startServer, 3000);
    });

    // Timeout - resolve anyway after 30s
    setTimeout(resolve, 30000);
  });
}

// Health check
function healthCheck() {
  const req = http.get('http://127.0.0.1:3000/api/dashboard', (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      if (res.statusCode !== 200) {
        fs.appendFileSync(LOG_FILE, `[health] Bad status ${res.statusCode}\n`);
      }
    });
  });
  req.on('error', () => {
    fs.appendFileSync(LOG_FILE, `[health] Connection failed\n`);
  });
  req.setTimeout(5000, () => req.destroy());
}

startServer().then(() => {
  fs.appendFileSync(LOG_FILE, `[main] Server started successfully\n`);
  setInterval(healthCheck, 60000);
});
