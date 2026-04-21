import http from 'http';

const MAIN_SERVER = 'http://127.0.0.1:3000';
const PING_INTERVAL = 30000; // 30 seconds

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'alive', timestamp: new Date().toISOString() }));
});

server.listen(3005, () => {
  console.log(`Keepalive service running on port 3005`);

  function ping() {
    http.get(`${MAIN_SERVER}/api/notifications/unread-count`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        console.log(`[${new Date().toISOString()}] Ping OK: ${data.trim()}`);
        setTimeout(ping, PING_INTERVAL);
      });
    }).on('error', (e) => {
      console.error(`[${new Date().toISOString()}] Ping failed: ${e.message}`);
      setTimeout(ping, 10000);
    });
  }

  setTimeout(ping, 5000);
});
