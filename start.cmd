@echo off
echo ================================
echo   Deal Cellular - Starting Up
echo ================================
echo.
echo [1/2] Pulling latest from Git...
git pull
echo.
echo [2/2] Starting dev server...
npm run dev
