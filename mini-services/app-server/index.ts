import { spawn } from 'child_process';
import http from 'http';

let server: ReturnType<typeof spawn> | null = null;

function startNextServer() {
  if (server) {
    try { server.kill('SIGKILL'); } catch {}
  }

  console.log('[app-server] Starting Next.js production server on port 3000...');

  server = spawn('node', ['.next/standalone/server.js'], {
    cwd: '/home/z/my-project',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production', PORT: '3000' }
  });

  server.stdout?.on('data', (d: Buffer) => {
    process.stdout.write(d);
  });

  server.stderr?.on('data', (d: Buffer) => {
    process.stderr.write(d);
  });

  server.on('exit', (code) => {
    console.log(`[app-server] Next.js exited with code ${code}. Restarting in 3s...`);
    setTimeout(startNextServer, 3000);
  });

  server.on('error', (err) => {
    console.error('[app-server] Error:', err.message);
    setTimeout(startNextServer, 3000);
  });
}

// Health check every 30s
function healthCheck() {
  const req = http.get('http://127.0.0.1:3000/api/dashboard', (res) => {
    const chunks: Buffer[] = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log(`[health] OK (${chunks.toString().length} bytes)`);
      } else {
        console.log(`[health] Bad status ${res.statusCode}, restarting...`);
        server?.kill('SIGKILL');
      }
    });
  });
  req.on('error', () => {
    console.log('[health] Connection failed, restarting...');
    server?.kill('SIGKILL');
  });
  req.setTimeout(5000, () => {
    req.destroy();
    console.log('[health] Timeout, restarting...');
    server?.kill('SIGKILL');
  });
}

// Start
startNextServer();
setInterval(healthCheck, 30000);

// Keep process alive
setInterval(() => {}, 60000);
