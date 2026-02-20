#!/bin/bash

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 KUMO UNIFIED DEV SERVER"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Kill existing processes
echo "🛑 Stopping existing servers..."
pkill -f "ts-node.*src/index.ts" 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "ngrok http 3000" 2>/dev/null
sleep 2

cd /home/novartisassets/kumo

# Start backend
echo -e "${BLUE}🚀 Starting Backend on port 3000...${NC}"
npm run dev > /tmp/kumo-backend.log 2>&1 &
BACKEND_PID=$!
sleep 5

# Check if backend started (check if port responds)
if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>&1 | grep -q "401"; then
    echo "❌ Backend failed to start. Check /tmp/kumo-backend.log"
    exit 1
fi
echo -e "${GREEN}✅ Backend running on http://localhost:3000${NC}"

# Start ngrok tunnel
echo -e "${BLUE}🌐 Starting Ngrok tunnel...${NC}"
nohup ngrok http 3000 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!
sleep 6

# Get ngrok public URL
NGROK_URL=""
for i in {1..10}; do
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys, json; data = json.load(sys.stdin); print([t['public_url'] for t in data.get('tunnels', []) if 'https' in t['public_url']][0])" 2>/dev/null)
    if [ -n "$NGROK_URL" ]; then
        break
    fi
    sleep 1
done

if [ -z "$NGROK_URL" ]; then
    echo "⚠️  Ngrok URL not found yet, checking logs..."
    tail -5 /tmp/ngrok.log
fi

if [ -n "$NGROK_URL" ]; then
    echo -e "${GREEN}✅ Ngrok tunnel active: $NGROK_URL${NC}"
    
    # Update frontend .env
    echo "VITE_API_URL=$NGROK_URL/api" > /home/novartisassets/kumo/frontend/app/.env
    echo -e "${GREEN}✅ Frontend .env updated${NC}"
else
    echo "⚠️  Using localhost for API (will only work locally)"
    echo "VITE_API_URL=http://localhost:3000/api" > /home/novartisassets/kumo/frontend/app/.env
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}  ✅ ALL SERVERS STARTED!${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo -e "${BLUE}📊 Backend:${NC}     http://localhost:3000"
echo -e "${BLUE}🌐 Ngrok:${NC}       $NGROK_URL"
echo -e "${BLUE}📱 Frontend:${NC}    Will start on http://localhost:5173"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""

# Start frontend (this stays in foreground so user can see logs)
echo -e "${YELLOW}🚀 Starting Frontend Dev Server...${NC}"
echo -e "${YELLOW}   (Press Ctrl+C to stop all servers)${NC}"
echo ""
cd /home/novartisassets/kumo/frontend/app
npm run dev

# Cleanup when frontend stops
echo ""
echo "🛑 Stopping servers..."
kill $BACKEND_PID 2>/dev/null
kill $NGROK_PID 2>/dev/null
echo "✅ All servers stopped"