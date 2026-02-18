@echo off
REM KUMO Quick Start Script for Windows
REM This script sets up and tests the entire KUMO system

setlocal enabledelayedexpansion

echo.
echo ============================================================
echo.
echo  ^^3A KUMO QUICK START
echo.
echo ============================================================
echo.

REM Check if .env exists
if not exist ".env" (
    echo ERROR: .env file not found!
    echo.
    echo Please create .env with your API keys:
    echo.
    echo GROQ_API_KEY=gsk_...
    echo GROQ_MODEL=llama-3.3-70b-versatile
    echo GEMINI_API_KEY=...
    echo.
    pause
    exit /b 1
)

echo OK: Environment file found

REM Check if node_modules exists
if not exist "node_modules" (
    echo.
    echo Installing dependencies...
    call npm install
)

echo OK: Dependencies ready

REM Build TypeScript
echo.
echo Building TypeScript...
call npm run build > nul 2>&1

echo OK: Build complete

REM Display menu
:menu
echo.
echo ============================================================
echo WHAT WOULD YOU LIKE TO DO?
echo ============================================================
echo.
echo 1) Run ALL tests (PA + TA + SA + GA)
echo 2) Test PA (Parent Agent) only
echo 3) Test TA (Teacher Agent) only
echo 4) Test SA (Admin Agent) + Onboarding
echo 5) Test GA (Group Agent) only
echo 6) Start dev server (interactive WhatsApp)
echo 7) Reset database ^& start fresh
echo 8) Show documentation
echo 9) Exit
echo.
echo ============================================================
echo.

set /p choice="Select option (1-9): "

if "%choice%"=="1" (
    echo.
    echo Running FULL test suite...
    call npm run test:full
    goto menu
)
if "%choice%"=="2" (
    echo.
    echo Testing PA (Parent Agent)...
    call npm run test:pa
    goto menu
)
if "%choice%"=="3" (
    echo.
    echo Testing TA (Teacher Agent)...
    call npm run test:ta
    goto menu
)
if "%choice%"=="4" (
    echo.
    echo Testing SA (School Admin) + Onboarding...
    call npm run test:sa
    goto menu
)
if "%choice%"=="5" (
    echo.
    echo Testing GA (Group Agent)...
    call npm run test:ga
    goto menu
)
if "%choice%"=="6" (
    echo.
    echo Starting development server...
    echo Press Ctrl+C to stop
    echo.
    call npm run dev
    goto menu
)
if "%choice%"=="7" (
    echo.
    echo Resetting database...
    call npm run test:manual:reset
    echo.
    echo OK: Database reset complete
    echo.
    echo Starting dev server (scan QR code with WhatsApp)...
    call npm run dev
    goto menu
)
if "%choice%"=="8" (
    echo.
    echo Opening documentation...
    echo.
    start DEV_TEST_GUIDE_COMPREHENSIVE.md
    timeout /t 2 /nobreak
    goto menu
)
if "%choice%"=="9" (
    echo.
    echo Goodbye!
    exit /b 0
)

echo.
echo ERROR: Invalid option
goto menu
