@echo off
echo ============================================
echo Starting KUMO Frontend
echo ============================================
echo.
echo Frontend will run on: http://localhost:5173
echo.
echo ============================================

cd frontend\app

rem Start the frontend
npm run dev
