const http = require('http');

// Keep this process alive by doing periodic pings
function ping() {
  http.get('http://127.0.0.1:3000/api/notifications/unread-count', (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      console.log(`[${new Date().toISOString()}] Ping OK`);
      setTimeout(ping, 30000);
    });
  }).on('error', (e) => {
    console.error(`[${new Date().toISOString()}] Ping failed: ${e.message}`);
    setTimeout(ping, 10000);
  });
}

console.log('Self-ping started, pinging every 30s');
setTimeout(ping, 5000);
