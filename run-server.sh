#!/bin/bash
while true; do
    # Check if port 3000 is alive
    HTTP_CODE=$(curl -s -m 3 http://127.0.0.1:3000/api/dashboard -o /dev/null -w '%{http_code}' 2>/dev/null)
    if [ "$HTTP_CODE" != "200" ]; then
        echo "[$(date)] Server down (HTTP: $HTTP_CODE), restarting..." >> /tmp/server-watch.log
        # Kill stale
        pkill -f 'server.js' 2>/dev/null
        sleep 2
        # Move .config if needed
        if [ -f /home/z/my-project/.config ] && [ ! -d /home/z/my-project/.config ]; then
            cp /home/z/my-project/.config /tmp/.config-backup
            rm -f /home/z/my-project/.config
        fi
        cd /home/z/my-project
        cp -r .next/static .next/standalone/.next/static 2>/dev/null
        cp -r public .next/standalone/public 2>/dev/null
        PORT=3000 nohup node .next/standalone/server.js > /tmp/standalone.log 2>&1 &
        # Restore .config
        if [ -f /tmp/.config-backup ]; then
            cp /tmp/.config-backup /home/z/my-project/.config
            rm -f /tmp/.config-backup
        fi
        echo "[$(date)] Server started, PID: $!" >> /tmp/server-watch.log
        sleep 10
    fi
    sleep 20
done
