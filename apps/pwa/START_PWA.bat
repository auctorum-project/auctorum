@echo off
title Auctorum PWA Server
color 0A

echo.
echo  ╔══════════════════════════════════════╗
echo  ║       AUCTORUM PWA  -  Server        ║
echo  ╚══════════════════════════════════════╝
echo.

:: Navigate to server directory
cd /d "%~dp0server"

:: Check if node_modules exist
if not exist "node_modules" (
    echo [*] Installing server dependencies...
    npm install
    echo.
)

:: Check if client is built
if not exist "..\client\dist\index.html" (
    echo [*] Building client for production...
    cd /d "%~dp0client"
    npm install
    npm run build
    cd /d "%~dp0server"
    echo.
)

echo [+] Starting Auctorum PWA server on port 3001...
echo [+] Open http://localhost:3001 in your browser
echo [+] On iPhone: Add to Home Screen for PWA experience
echo.
echo     Press Ctrl+C to stop the server
echo.

node src/index.js

pause
