const { spawn } = require('child_process');
const http = require('http');

let server = null;

function startNextServer() {
  if (server) {
    try { server.kill('SIGKILL'); } catch {}
  }

  console.log('[app-server] Starting Next.js production server on port 3000...');

  server = spawn('node', ['/home/z/my-project/.next/standalone/server.js'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production', PORT: '3000' }
  });

  server.stdout.on('data', (d) => process.stdout.write(d));
  server.stderr.on('data', (d) => process.stderr.write(d));

  server.on('exit', (code) => {
    console.log('[app-server] Exited with code ' + code + '. Restarting in 3s...');
    setTimeout(startNextServer, 3000);
  });

  server.on('error', (err) => {
    console.error('[app-server] Error:', err.message);
    setTimeout(startNextServer, 3000);
  });
}

function healthCheck() {
  const req = http.get('http://127.0.0.1:3000/api/dashboard', (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('[health] OK (' + data.length + ' bytes)');
      } else {
        console.log('[health] Bad status ' + res.statusCode + ', restarting...');
        if (server) server.kill('SIGKILL');
      }
    });
  });
  req.on('error', () => {
    console.log('[health] Failed, restarting...');
    if (server) server.kill('SIGKILL');
  });
  req.setTimeout(5000, () => {
    req.destroy();
    console.log('[health] Timeout, restarting...');
    if (server) server.kill('SIGKILL');
  });
}

startNextServer();
setInterval(healthCheck, 30000);
setInterval(() => {}, 60000);
