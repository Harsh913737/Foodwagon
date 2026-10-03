@echo off
title Push Food Wagon WhatsApp Gateway to GitHub
color 0b
cd /d "%~dp0"
echo ========================================================
echo    PUSH WHATSAPP GATEWAY TO GITHUB FOR RENDER.COM
echo ========================================================
echo.
echo Step 1: Open GitHub (https://github.com/new) and create
echo         a new repository (e.g. foodwagon-wa-gateway).
echo.
set /p REPO_URL="Enter your GitHub Repository URL (e.g. https://github.com/username/foodwagon-wa-gateway.git): "

if "%REPO_URL%"=="" (
    echo Error: No repository URL entered.
    pause
    exit /b
)

git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main
echo.
echo Pushing code to GitHub...
git push -u origin main

echo.
echo ========================================================
echo Code pushed successfully!
echo Now go to https://dashboard.render.com to deploy:
echo 1. Click "New +" -> "Web Service"
echo 2. Connect this GitHub repo
echo 3. Instance Type: Free
echo 4. Click "Deploy Web Service"
echo ========================================================
pause
