@echo off
echo Starting BoardRoom AI services...

set FRONTEND_DIR=%~dp0boardroom-sim
set STREAM_DIR=%~dp0boardroom-sim-stream
set WEBHOOK_DIR=%~dp0webhook-server
set LANDING_DIR=%~dp0landing_page

echo [1/5] Starting Cloudflare Tunnel...
start "Cloudflare Tunnel" cmd /k "title [Boardroom] Cloudflare Tunnel && cloudflared tunnel run boardroom"

echo [2/5] Starting Landing Page (port 3901)...
start "Landing Page" cmd /k "title [Boardroom] Landing Page :3901 && cd /d "%LANDING_DIR%" && npx serve -l 3901"

echo [3/5] Starting Frontend (port 5901)...
start "Frontend" cmd /k "title [Boardroom] Frontend :5901 && cd /d "%FRONTEND_DIR%" && npx serve -s dist -l 5901"

echo [4/5] Starting Stream Frontend (port 5902)...
start "Stream Frontend" cmd /k "title [Boardroom] Stream Frontend :5902 && cd /d "%STREAM_DIR%" && npx serve -s dist -l 5902"

echo [5/5] Starting Webhook Server (port 8901)...
start "Webhook Server" cmd /k "title [Boardroom] Webhook Server :8901 && cd /d "%WEBHOOK_DIR%" && venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8901"

echo.
echo All services started in separate windows.
echo   Landing Page:     http://localhost:3901  ^(boardroom.kreygo.com^)
echo   Frontend:         http://localhost:5901  ^(sim.kreygo.com^)
echo   Stream Frontend:  http://localhost:5902  ^(local only^)
echo   Webhook Server:   http://localhost:8901  ^(api.kreygo.com^)
echo   Cloudflare Tunnel: routing tunneled services only
echo.
echo Close each window to stop its service.
