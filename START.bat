@echo off
title WhatsApp Bulk Checker
cd /d "%~dp0"

echo.
echo  ==========================================
echo    WhatsApp Bulk Checker v2 - TURBO MODE
echo    Browser Mode - No Account Linking
echo  ==========================================
echo.

:: 1. Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Download it from https://nodejs.org
    pause
    exit /b
)

:: 2. Auto-kill any old server stuck on Port 3000 to prevent EADDRINUSE crash
echo [*] Cleaning up old processes...
FOR /F "tokens=5" %%a IN ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') DO taskkill /F /PID %%a >nul 2>nul
timeout /t 1 /nobreak >nul

:: 3. Install dependencies if missing
if not exist "node_modules\" (
    echo [*] First run — installing dependencies...
    call npm install
    echo.
)

echo [*] Starting server + browser...
echo [*] Dashboard: http://localhost:3000
echo.
echo    1. Scan QR in the Chrome window
echo    2. Open http://localhost:3000 in your browser
echo    3. Upload numbers and click Start
echo.

:: 4. Start the app
node server.js

pause
