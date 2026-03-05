@echo off
title Deal Cellular
echo.
echo  ================================
echo    Deal Cellular - Starting Up
echo  ================================
echo.

cd /d "%~dp0"

echo  [1/2] Starting auto-sync (background)...
start "Deal Cellular SYNC" /min C:\PROGRA~1\nodejs\node.exe sync.mjs

echo  [2/2] Starting dev server...
echo.
C:\PROGRA~1\nodejs\npm.cmd run dev
