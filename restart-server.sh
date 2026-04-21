#!/bin/bash
# Check if port 3000 is already listening
if ss -tlnp | grep -q ':3000.*LISTEN'; then
    exit 0
fi
# Kill any zombie processes
pkill -f "next dev" 2>/dev/null
sleep 1
# Start server
cd /home/z/my-project
nohup node node_modules/.bin/next dev -p 3000 >> /tmp/next_auto.log 2>&1 &
echo "$(date): Server restarted" >> /tmp/next_auto.log
