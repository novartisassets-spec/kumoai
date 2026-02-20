#!/bin/bash

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 KUMO RESTART SCRIPT"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Kill existing processes
echo "🛑 Stopping existing servers..."
pkill -f "ts-node.*src/index.ts" 2>/dev/null
pkill -f "lt --port 3000" 2>/dev/null
sleep 2

# Start backend
echo "🚀 Starting backend..."
nohup npm run dev > /tmp/kumo-backend.log 2>&1 &
sleep 5

# Check if backend started (check if port responds)
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>&1 | grep -q "401"; then
    echo "❌ Backend failed to start"
    exit 1
fi
echo "✅ Backend running on http://localhost:3000"

# Start localtunnel
echo "🌐 Starting localtunnel..."
nohup lt --port 3000 > /tmp/lt.log 2>&1 &
sleep 5

# Get the tunnel URL
TUNNEL_URL=$(grep -oE "https://[a-z0-9-]+\.loca\.lt" /tmp/lt.log | head -1)

if [ -z "$TUNNEL_URL" ]; then
    echo "⚠️  Localtunnel starting, checking again in 3 seconds..."
    sleep 3
    TUNNEL_URL=$(grep -oE "https://[a-z0-9-]+\.loca\.lt" /tmp/lt.log | head -1)
fi

if [ -n "$TUNNEL_URL" ]; then
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  ✅ KUMO IS READY!"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "🌐 Access your app at:"
    echo "   $TUNNEL_URL"
    echo ""
    echo "⚠️  If you see a password page, just type 'kumo' and click Allow"
    echo ""
    echo "📱 You can now test on your mobile device!"
    echo "═══════════════════════════════════════════════════════════"
else
    echo "⚠️  Localtunnel URL not found. Check /tmp/lt.log"
fi

echo ""
echo "💡 Logs available:"
echo "   Backend: tail -f /tmp/kumo-backend.log"
echo "   Tunnel:  tail -f /tmp/lt.log"