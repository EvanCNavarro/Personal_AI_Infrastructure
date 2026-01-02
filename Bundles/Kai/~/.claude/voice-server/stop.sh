#!/bin/bash
# Stop voice server

echo "▶ Stopping Voice Server..."

# Find and kill the voice server process
pkill -f "voice-server/server.ts" 2>/dev/null

# Also check by port
if lsof -i :8888 > /dev/null 2>&1; then
    kill $(lsof -t -i :8888) 2>/dev/null
fi

sleep 1

if ! lsof -i :8888 > /dev/null 2>&1; then
    echo "✓ Voice server stopped"
else
    echo "⚠ Voice server may still be running"
fi
