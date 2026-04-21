#!/bin/bash
# Keep-alive dev server for Aura Academy
cd /home/z/my-project

while true; do
    echo "[$(date)] Starting Next.js dev server..."
    node node_modules/.bin/next dev -p 3000
    echo "[$(date)] Server stopped. Restarting in 3s..."
    sleep 3
done
