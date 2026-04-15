@echo off
echo Starting Boardroom Simulator Stream...

cd /d "%~dp0"

echo [1/2] Building...
call npm run build
if errorlevel 1 (
    echo Build failed. Exiting.
    pause
    exit /b 1
)

echo [2/2] Serving on port 5902...
start "Boardroom Stream" cmd /k "npx serve -s dist -l 5902"

echo.
echo Stream app running at http://localhost:5902
echo Close the opened window to stop.
