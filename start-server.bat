@echo off
chcp 65001 > nul
setlocal

title Library Store (Backend Server - Windows 7 Edition)

echo ========================================================
echo   Starting Library Store Server (Local Offline Mode)
echo ========================================================

cd /d "%~dp0"

set "DATABASE_URL=file:%~dp0data\custom.db"
set "PORT=3210"
set "HOSTNAME=127.0.0.1"
set "NODE_ENV=production"
set "NODE_SKIP_PLATFORM_CHECK=1"

if exist "desktop\bin\node.exe" (
    echo Using bundled Node runtime: desktop\bin\node.exe
    "desktop\bin\node.exe" server\server.js
) else if exist "bin\node.exe" (
    echo Using bundled Node runtime: bin\node.exe
    "bin\node.exe" server\server.js
) else (
    echo Using system Node runtime
    node server\server.js
)

pause
