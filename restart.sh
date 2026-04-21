#!/bin/bash
# Aura Academy - Server Restart Script
# Usage: bash restart.sh

cd /home/z/my-project

# Kill any existing processes
pkill -f 'server.js' 2>/dev/null
pkill -f 'next' 2>/dev/null  
pkill -f 'bun' 2>/dev/null
sleep 2

# Start standalone server
DATABASE_URL="file:./db/dev.db" PORT=3000 nohup node .next/standalone/server.js > /tmp/standalone.log 2>&1 &

# Wait and verify
sleep 5
if ss -tlnp | grep -q :3000; then
  echo "✅ Server started on port 3000"
  curl -sI -m 5 http://127.0.0.1:3000/ | head -1
else
  echo "❌ Server failed to start"
  tail -10 /tmp/standalone.log
fi
