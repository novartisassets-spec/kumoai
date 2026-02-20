#!/bin/bash

# Kumo Unified Start Script
# Runs backend which serves both API and frontend

echo "═══════════════════════════════════════════════════════════"
echo "  🚀 KUMO UNIFIED SERVER STARTER"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check if we're in the right directory
if [ ! -f "src/index.ts" ]; then
    echo "❌ Error: Please run this script from the kumo root directory"
    exit 1
fi

# Build frontend first
echo "📦 Building frontend..."
cd frontend/app
npm run build > /dev/null 2>&1
cd ../..

if [ $? -eq 0 ]; then
    echo "✅ Frontend built successfully"
else
    echo "⚠️  Frontend build had issues, continuing..."
fi

echo ""
echo "🚀 Starting Kumo Server..."
echo "   Backend + Frontend will be served from the same port"
echo ""

# Start the backend (which now serves frontend too)
npm run dev

# Note: The server will be available on port 3000
# In Cloud Shell, use Web Preview on port 3000 to access the full app