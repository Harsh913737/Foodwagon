@echo off
title Food Wagon WhatsApp Gateway Launcher
color 0a
cd /d "%~dp0"
echo ========================================================
echo    STARTING FOOD WAGON WHATSAPP GATEWAY (8879511519)
echo ========================================================
echo.
echo 1. Starting Node.js WhatsApp Gateway Service...
start "Food Wagon WhatsApp Gateway (Terminal QR)" cmd /k "color 0a && node server.js"

echo 2. Waiting 3 seconds for service initialization...
timeout /t 3 /nobreak >nul

echo 3. Starting Cloudflare Tunnel & Auto Hostinger Sync...
start "Food Wagon Cloudflare Sync" cmd /k "color 0b && python launch_and_sync.py"

echo.
echo ========================================================
echo  All services started successfully!
echo.
echo  1. Your browser will open http://localhost:3000
echo  2. Scan the QR code using WhatsApp on 8879511519:
echo     (Open WhatsApp -> Linked Devices -> Link a Device)
echo  3. The tunnel URL will be automatically saved to
echo     Hostinger server database!
echo ========================================================
echo.
pause
