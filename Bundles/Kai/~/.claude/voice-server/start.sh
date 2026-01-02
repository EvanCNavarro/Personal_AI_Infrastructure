#!/bin/bash
# Start voice server

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "▶ Starting Voice Server..."

# Check if already running
if lsof -i :8888 > /dev/null 2>&1; then
    echo "⚠ Voice server is already running on port 8888"
    exit 0
fi

# Start in background
nohup bun run "$SCRIPT_DIR/server.ts" > ~/Library/Logs/pai-voice-server.log 2>&1 &

sleep 2

if curl -s -f -X GET http://localhost:8888/health > /dev/null 2>&1; then
    echo "✓ Voice server started successfully"
else
    echo "⚠ Server started but not responding yet"
    echo "  Check logs: tail -f ~/Library/Logs/pai-voice-server.log"
fi
