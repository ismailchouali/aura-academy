const { spawn } = require('child_process');

let server;

function start() {
  server = spawn('node', ['node_modules/.bin/next', 'dev', '-p', '3000'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: '/home/z/my-project'
  });
  
  server.on('exit', () => {
    console.log('[keep-alive] Server died, restarting in 2s...');
    setTimeout(start, 2000);
  });
}

start();

// Health check every 60s
const http = require('http');
setInterval(() => {
  const req = http.get('http://localhost:3000/api/dashboard', (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('[' + new Date().toISOString() + '] OK');
      } else {
        console.log('[' + new Date().toISOString() + '] BAD STATUS ' + res.statusCode + ' - restarting');
        server.kill('SIGKILL');
      }
    });
  });
  req.on('error', () => {
    console.log('[' + new Date().toISOString() + '] FAIL - restarting');
    server.kill('SIGKILL');
  });
  req.setTimeout(5000, () => {
    req.destroy();
    console.log('[' + new Date().toISOString() + '] TIMEOUT - restarting');
    server.kill('SIGKILL');
  });
}, 60000);
