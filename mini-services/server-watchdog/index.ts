import { spawn } from 'child_process';
import net from 'net';

const APP_DIR = '/home/z/my-project';
const PORT = 3000;
const CHECK_INTERVAL = 5000; // check every 5s
const STARTUP_WAIT = 10000;

let serverProcess: ReturnType<typeof spawn> | null = null;

function isPortListening(): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.createConnection(PORT, '127.0.0.1', () => {
      sock.destroy();
      resolve(true);
    });
    sock.on('error', () => {
      sock.destroy();
      resolve(false);
    });
    sock.setTimeout(2000, () => {
      sock.destroy();
      resolve(false);
    });
  });
}

function startServer() {
  if (serverProcess) {
    try {
      serverProcess.kill('SIGTERM');
    } catch {}
  }

  console.log(`[${new Date().toISOString()}] Starting Next.js dev server...`);

  serverProcess = spawn('bun', ['run', 'dev', '--port', String(PORT)], {
    cwd: APP_DIR,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[SERVER] ${data.toString().trim()}`);
  });

  serverProcess.stderr?.on('data', (data: Buffer) => {
    console.error(`[SERVER-ERR] ${data.toString().trim()}`);
  });

  serverProcess.on('exit', (code) => {
    console.log(`[${new Date().toISOString()}] Server exited with code ${code}`);
    serverProcess = null;
  });
}

async function checkAndRestart() {
  const listening = await isPortListening();
  if (!listening) {
    console.log(`[${new Date().toISOString()}] Port ${PORT} not responding, restarting...`);
    startServer();
  } else {
    console.log(`[${new Date().toISOString()}] Port ${PORT} OK`);
  }
}

// Initial start
startServer();

// Wait for startup then start checking
setTimeout(() => {
  setInterval(checkAndRestart, CHECK_INTERVAL);
}, STARTUP_WAIT);

// Keep process alive
setInterval(() => {
  if (serverProcess) {
    try {
      // Send signal 0 to check if process is still alive
      serverProcess.kill(0);
    } catch {
      console.log(`[${new Date().toISOString()}] Process dead, restarting...`);
      startServer();
    }
  }
}, 3000);
