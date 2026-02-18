@echo off
echo ============================================
echo Starting KUMO Backend
echo ============================================
echo.
if not exist dist (
    echo Building backend...
    npm run build
)
echo.
echo Starting backend on port 3000...
echo.
node dist/index.js
