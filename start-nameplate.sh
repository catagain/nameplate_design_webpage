#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

REQUESTED_PORT="${PORT:-3001}"
HOST="${HOST:-0.0.0.0}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-}"
APP_HOST="localhost"

if [ -z "$PUBLIC_BASE_URL" ]; then
    APP_HOST="$(node -e 'const os=require("os"); const interfaces=os.networkInterfaces(); const preferred=[]; const fallback=[]; const isPrivate=ip => /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip); for (const entries of Object.values(interfaces)) { for (const entry of entries || []) { if (!entry || entry.family !== "IPv4" || entry.internal) continue; if (isPrivate(entry.address)) preferred.push(entry.address); else fallback.push(entry.address); } } process.stdout.write(preferred[0] || fallback[0] || "localhost");')"
fi

if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js is not installed or not in PATH."
    echo "Please install Node.js 18+ first: https://nodejs.org/"
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "[ERROR] npm is not installed or not in PATH."
    echo "Please reinstall Node.js and make sure npm is available."
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing dependencies..."
    npm install
fi

PORT="$(PORT="$REQUESTED_PORT" HOST="$HOST" node -e 'const net=require("net"); const host=process.env.HOST || "0.0.0.0"; const start=parseInt(process.env.PORT || "3001", 10); const max=start + 50; const checkPort=port => new Promise(resolve => { const server=net.createServer(); server.unref(); server.once("error", () => resolve(false)); server.listen({ host, port }, () => server.close(() => resolve(true))); }); (async () => { if (Number.isNaN(start) || start < 1 || start > 65535) { process.exit(2); } for (let port = start; port <= max && port <= 65535; port += 1) { if (await checkPort(port)) { process.stdout.write(String(port)); return; } } process.exit(1); })().catch(() => process.exit(1));')"
if [ -z "$PUBLIC_BASE_URL" ]; then
    PUBLIC_BASE_URL="http://${APP_HOST}:${PORT}"
fi
APP_URL="${PUBLIC_BASE_URL}"

echo "[INFO] Using port ${PORT}"
echo "[INFO] Starting nameplate web server on ${APP_URL}"

if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "${APP_URL}" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
    open "${APP_URL}" >/dev/null 2>&1 &
fi

PORT="$PORT" HOST="$HOST" PUBLIC_BASE_URL="$PUBLIC_BASE_URL" npm start