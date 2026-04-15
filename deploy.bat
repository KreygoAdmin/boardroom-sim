@echo off
echo Deploying BoardRoom AI...

set FRONTEND_DIR=%~dp0boardroom-sim
set STREAM_DIR=%~dp0boardroom-sim-stream

echo [1/4] Building frontend...
cd /d "%FRONTEND_DIR%"
call npm run build
if errorlevel 1 (
    echo Frontend build failed! Aborting deploy.
    pause
    exit /b 1
)

echo [2/4] Building stream frontend...
cd /d "%STREAM_DIR%"
call npm run build
if errorlevel 1 (
    echo Stream build failed! Aborting deploy.
    pause
    exit /b 1
)

echo.
echo [3/4] Stopping existing services...

:: Kill cloudflared tunnel
taskkill /IM cloudflared.exe /F >nul 2>&1

:: Kill process on port 3901 (landing page)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3901 "') do taskkill /PID %%a /F >nul 2>&1

:: Kill process on port 5901 (frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5901 "') do taskkill /PID %%a /F >nul 2>&1

:: Kill process on port 5902 (stream frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5902 "') do taskkill /PID %%a /F >nul 2>&1

:: Kill process on port 8901 (webhook server)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8901 "') do taskkill /PID %%a /F >nul 2>&1

timeout /t 2 /nobreak >nul

echo [4/4] Starting services...
cd /d "%~dp0"
call start.bat

echo.
echo Deploy complete!
