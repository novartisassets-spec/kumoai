@echo off
echo ============================================
echo Starting KUMO Backend
echo ============================================
echo.
echo Backend will run on: http://localhost:3000
echo API endpoints: http://localhost:3000/api/*
echo.
echo If you see "Kumo API Server running", it's ready!
echo.
echo ============================================

rem Build if needed
if not exist dist (
    echo Building backend...
    npm run build
    echo.
)

rem Start the backend
echo Starting backend...
node dist/index.js
