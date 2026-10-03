@echo off
title Food Wagon WhatsApp Cloudflare Tunnel
color 0b
cd /d "%~dp0"
echo ========================================================
echo       CONNECTING GATEWAY TO HOSTINGER (FREE TUNNEL)
echo ========================================================
echo.
echo Starting Cloudflare Tunnel for http://localhost:3000 ...
echo Look for the https://....trycloudflare.com URL below!
echo.
"F:\Programs\cloudflared.exe" tunnel --url http://localhost:3000
pause
