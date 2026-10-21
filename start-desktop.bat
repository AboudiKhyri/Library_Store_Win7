@echo off
chcp 65001 > nul
setlocal

title Library Store (Desktop App)

echo ========================================================
echo   Starting Library Store Desktop App (Windows 7 Edition)
echo ========================================================

cd /d "%~dp0"

set "DATABASE_URL=file:../data/custom.db"
set "PORT=3210"

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
