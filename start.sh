#!/bin/bash
# Start the dev server if not already running
cd /home/z/my-project

if ss -tlnp 2>/dev/null | grep -q 3000; then
  echo "Server already running on port 3000"
  exit 0
fi

rm -rf .next
setsid npx next dev -p 3000 </dev/null &>/home/z/my-project/dev.log &
echo "Dev server starting on port 3000..."

# Wait for server to be ready
for i in $(seq 1 30); do
  if ss -tlnp 2>/dev/null | grep -q 3000; then
    echo "Server ready!"
    exit 0
  fi
  sleep 1
done

echo "Failed to start server"
exit 1
