@echo off
setlocal

cd /d "%~dp0"

if not defined PORT set "PORT=3001"
set "HOST=0.0.0.0"
set "APP_HOST=localhost"

if not defined PUBLIC_BASE_URL (
    for /f "usebackq delims=" %%I in (`node -e "const os=require('os'); const interfaces=os.networkInterfaces(); const preferred=[]; const fallback=[]; const isPrivate=ip => { if (!ip) return false; if (ip.startsWith('10.')) return true; if (ip.startsWith('192.168.')) return true; if (!ip.startsWith('172.')) return false; const second=parseInt(ip.split('.')[1], 10); return second >= 16 && second <= 31; }; for (const entries of Object.values(interfaces)) { if (!entries) continue; for (const entry of entries) { if (!entry) continue; if (entry.family !== 'IPv4') continue; if (entry.internal) continue; if (isPrivate(entry.address)) preferred.push(entry.address); else fallback.push(entry.address); } } process.stdout.write(preferred.length ? preferred[0] : (fallback.length ? fallback[0] : 'localhost'));"`) do set "APP_HOST=%%I"
)

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js 18+ first: https://nodejs.org/
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm is not installed or not in PATH.
    echo Please reinstall Node.js and make sure npm is available.
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        exit /b 1
    )
)

for /f "usebackq delims=" %%P in (`node -e "const net=require('net'); const host=process.env.HOST || '0.0.0.0'; const start=parseInt(process.env.PORT || '3001', 10); const max=start + 50; const checkPort=port => new Promise(resolve => { const server=net.createServer(); server.unref(); server.once('error', () => resolve(false)); server.listen({ host, port }, () => server.close(() => resolve(true))); }); (async () => { if (Number.isNaN(start) || start < 1 || start > 65535) { process.exit(2); } for (let port = start; port <= max && port <= 65535; port += 1) { if (await checkPort(port)) { process.stdout.write(String(port)); return; } } process.exit(1); })().catch(() => process.exit(1));"`) do set "PORT=%%P"

if not defined PORT (
    echo [ERROR] Could not find an available port between 3001 and 3051.
    exit /b 1
)

set "APP_URL=http://localhost:%PORT%"
if not defined PUBLIC_BASE_URL set "PUBLIC_BASE_URL=http://%APP_HOST%:%PORT%"
set "APP_URL=%PUBLIC_BASE_URL%"
echo [INFO] Using port %PORT%
echo [INFO] Starting nameplate web server on %APP_URL%
start "" "%APP_URL%"

set "PORT=%PORT%"
set "HOST=%HOST%"
set "PUBLIC_BASE_URL=%PUBLIC_BASE_URL%"
call npm start

endlocal