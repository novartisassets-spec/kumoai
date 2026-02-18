#!/bin/bash

# KUMO Quick Start Script
# This script sets up and tests the entire KUMO system

set -e

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "🚀 KUMO QUICK START"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "Please create .env with your API keys:"
    echo ""
    echo "GROQ_API_KEY=gsk_..."
    echo "GROQ_MODEL=llama-3.3-70b-versatile"
    echo "GEMINI_API_KEY=..."
    echo ""
    exit 1
fi

echo "✅ Environment file found"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "✅ Dependencies ready"

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build > /dev/null 2>&1

echo "✅ Build complete"

# Display menu
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "WHAT WOULD YOU LIKE TO DO?"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "1) Run ALL tests (PA + TA + SA + GA)"
echo "2) Test PA (Parent Agent) only"
echo "3) Test TA (Teacher Agent) only"
echo "4) Test SA (Admin Agent) + Onboarding"
echo "5) Test GA (Group Agent) only"
echo "6) Start dev server (interactive WhatsApp)"
echo "7) Reset database & start fresh"
echo "8) Show documentation"
echo "9) Exit"
echo ""
echo "════════════════════════════════════════════════════════════════"

read -p "Select option (1-9): " choice

case $choice in
    1)
        echo ""
        echo "🧪 Running FULL test suite..."
        npm run test:full
        ;;
    2)
        echo ""
        echo "🧪 Testing PA (Parent Agent)..."
        npm run test:pa
        ;;
    3)
        echo ""
        echo "🧪 Testing TA (Teacher Agent)..."
        npm run test:ta
        ;;
    4)
        echo ""
        echo "🧪 Testing SA (School Admin) + Onboarding..."
        npm run test:sa
        ;;
    5)
        echo ""
        echo "🧪 Testing GA (Group Agent)..."
        npm run test:ga
        ;;
    6)
        echo ""
        echo "🚀 Starting development server..."
        echo "Press Ctrl+C to stop"
        echo ""
        npm run dev
        ;;
    7)
        echo ""
        echo "🗑️ Resetting database..."
        npm run test:manual:reset
        echo ""
        echo "✅ Database reset complete"
        echo ""
        echo "Starting dev server (scan QR code with WhatsApp)..."
        npm run dev
        ;;
    8)
        echo ""
        echo "📖 Opening documentation..."
        echo ""
        if command -v xdg-open &> /dev/null; then
            xdg-open DEV_TEST_GUIDE_COMPREHENSIVE.md
        elif command -v open &> /dev/null; then
            open DEV_TEST_GUIDE_COMPREHENSIVE.md
        else
            echo "Documentation: DEV_TEST_GUIDE_COMPREHENSIVE.md"
            echo "               PRODUCTION_READINESS_REPORT_JAN_4_2026.md"
        fi
        ;;
    9)
        echo ""
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ Done!"
echo "════════════════════════════════════════════════════════════════"
echo ""
