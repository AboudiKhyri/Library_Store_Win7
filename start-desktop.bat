@echo off
chcp 65001 > nul
setlocal

title Library Store (Desktop App)

echo ========================================================
echo   Starting Library Store Desktop App (Windows 7 Edition)
echo ========================================================

cd /d "%~dp0"

set "DATABASE_URL=file:%~dp0data\custom.db"
set "PORT=3210"

:: 1. Clean up any stale or zombie processes from previous sessions
taskkill /F /IM "Library Store.exe" >nul 2>&1
taskkill /F /IM "Library_Store.exe" >nul 2>&1

:: 2. Clear Chromium V8 code cache to ensure latest UI & styles load immediately
if exist "%APPDATA%\library-store\Cache" (
    rmdir /S /Q "%APPDATA%\library-store\Cache" >nul 2>&1
)
if exist "%APPDATA%\library-store\Code Cache" (
    rmdir /S /Q "%APPDATA%\library-store\Code Cache" >nul 2>&1
)
if exist "%APPDATA%\library-store\GPUCache" (
    rmdir /S /Q "%APPDATA%\library-store\GPUCache" >nul 2>&1
)

:: 3. Launch application
if exist "dist-desktop\win-unpacked\Library Store.exe" (
    echo Launching Desktop App from dist-desktop...
    start "" "dist-desktop\win-unpacked\Library Store.exe"
) else if exist "dist-desktop\win-unpacked\Library_Store.exe" (
    echo Launching Desktop App from dist-desktop...
    start "" "dist-desktop\win-unpacked\Library_Store.exe"
) else if exist "node_modules\electron\dist\electron.exe" (
    echo Launching Desktop App via Electron runner...
    start "" "node_modules\electron\dist\electron.exe" desktop\main.js
) else (
    echo [ERROR] Application binary not found.
    pause
)
